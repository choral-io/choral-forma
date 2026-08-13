import { MultiDirectedGraph } from "graphology";
import forceLayout from "graphology-layout-force";
import forceAtlas2, { type ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import ForceAtlas2LayoutSupervisor from "graphology-layout-forceatlas2/worker";

import type {
    GraphDisplayEdgeState,
    GraphLayoutEngine,
    GraphLayoutOptions,
    GraphPosition,
    GraphViewSnapshot,
} from "./types.ts";

export type GraphologyNodeAttributes = {
    x: number;
    y: number;
    size: number;
    color: string;
    label: string;
    path: string;
    kind: string;
    type: "circle";
};

export type GraphologyEdgeAttributes = {
    size: number;
    color: string;
    label: string;
    type: "arrow" | "doubleArrow";
};

export type GraphologyViewGraph = MultiDirectedGraph<GraphologyNodeAttributes, GraphologyEdgeAttributes>;

type LayoutSupervisor = {
    start(): void;
    stop(): void;
    kill(): void;
};

type LayoutSessionDependencies = {
    createSupervisor: (graph: GraphologyViewGraph, settings: ForceAtlas2Settings) => LayoutSupervisor;
    schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
    cancel: (timer: ReturnType<typeof setTimeout>) => void;
};

type GraphLayoutSessionOptions = GraphLayoutOptions & {
    onSettled?: () => void;
    runLayout?: boolean;
};

const DEFAULT_DEPENDENCIES: LayoutSessionDependencies = {
    createSupervisor: (graph, settings) => new ForceAtlas2LayoutSupervisor(graph, { settings }),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancel: (timer) => {
        clearTimeout(timer);
    },
};

export function buildGraphologyGraph(
    snapshot: GraphViewSnapshot,
    previousPositions: ReadonlyMap<string, GraphPosition> = new Map(),
): GraphologyViewGraph {
    const graph = new MultiDirectedGraph<GraphologyNodeAttributes, GraphologyEdgeAttributes>();
    const positions = seedPositions(snapshot, previousPositions);
    for (const node of snapshot.nodes) {
        const position = positions.get(node.id) ?? deterministicPosition(node.id);
        graph.addNode(node.id, {
            x: position.x,
            y: position.y,
            size: node.size,
            color: "#888888",
            label: node.title ?? node.path,
            path: node.path,
            kind: node.kind ?? "",
            type: "circle",
        });
    }
    for (const edge of snapshot.edges) {
        if (edge.source === edge.target || !graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
        graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
            size: 1,
            color: "#888888",
            label: edgeLabel(edge),
            type: edge.direction === "reciprocal" ? "doubleArrow" : "arrow",
        });
    }
    return graph;
}

export function settleInitialLayout(graph: GraphologyViewGraph, requestedEngine: GraphLayoutEngine): GraphLayoutEngine {
    const engine = resolveLayoutEngine(requestedEngine, graph.order);
    if (graph.order < 2 || graph.size === 0) return engine;
    if (engine === "force") {
        forceLayout.assign(graph, {
            maxIterations: Math.min(80, 24 + graph.order),
            settings: { attraction: 0.0008, gravity: 0.002, inertia: 0.5, maxMove: 24, repulsion: 0.12 },
        });
    } else {
        const iterations = graph.order <= 500 ? 12 : graph.order <= 2_000 ? 4 : 0;
        if (iterations === 0) return engine;
        forceAtlas2.assign(graph, {
            iterations,
            settings: forceAtlas2Settings(graph.order),
        });
    }
    return engine;
}

export function resolveLayoutEngine(requestedEngine: GraphLayoutEngine, nodeCount: number): GraphLayoutEngine {
    return requestedEngine === "auto" ? (nodeCount <= 64 ? "force" : "forceAtlas2") : requestedEngine;
}

export function graphPositions(graph: GraphologyViewGraph): ReadonlyMap<string, GraphPosition> {
    return new Map(graph.mapNodes((node, attributes) => [node, { x: attributes.x, y: attributes.y }] as const));
}

export class GraphLayoutSession {
    readonly #dependencies: LayoutSessionDependencies;
    readonly #onSettled: (() => void) | undefined;
    #supervisor: LayoutSupervisor | null = null;
    #timer: ReturnType<typeof setTimeout> | null = null;
    readonly #usesWorker: boolean;

    constructor(
        graph: GraphologyViewGraph,
        options: GraphLayoutSessionOptions,
        dependencies: LayoutSessionDependencies = DEFAULT_DEPENDENCIES,
    ) {
        this.#dependencies = dependencies;
        this.#onSettled = options.onSettled;
        if (options.runLayout === false) {
            this.#usesWorker = false;
            return;
        }
        const engine = settleInitialLayout(graph, options.engine);
        this.#usesWorker = !(
            options.reducedMotion ||
            !options.useWorker ||
            engine !== "forceAtlas2" ||
            graph.order < 2 ||
            graph.size === 0
        );
        if (!this.#usesWorker) return;

        this.#supervisor = dependencies.createSupervisor(graph, forceAtlas2Settings(graph.order));
        this.#supervisor.start();
        this.#timer = dependencies.schedule(() => {
            this.#finish();
        }, options.settleDurationMs);
    }

    get usesWorker(): boolean {
        return this.#usesWorker;
    }

    stop(): void {
        if (this.#timer) {
            this.#dependencies.cancel(this.#timer);
            this.#timer = null;
        }
        if (this.#supervisor) {
            this.#supervisor.stop();
            this.#supervisor.kill();
            this.#supervisor = null;
        }
    }

    destroy(): void {
        this.stop();
    }

    #finish(): void {
        this.stop();
        this.#onSettled?.();
    }
}

function forceAtlas2Settings(nodeCount: number): ForceAtlas2Settings {
    return {
        adjustSizes: true,
        barnesHutOptimize: nodeCount >= 250,
        edgeWeightInfluence: 0,
        gravity: 0.5,
        scalingRatio: nodeCount >= 500 ? 20 : nodeCount >= 100 ? 12 : 6,
        slowDown: nodeCount >= 500 ? 12 : 5,
        strongGravityMode: false,
    };
}

function seedPositions(
    snapshot: GraphViewSnapshot,
    previousPositions: ReadonlyMap<string, GraphPosition>,
): ReadonlyMap<string, GraphPosition> {
    const positions = new Map<string, GraphPosition>();
    const neighbors = new Map<string, Set<string>>();
    for (const node of snapshot.nodes) neighbors.set(node.id, new Set());
    for (const edge of snapshot.edges) {
        neighbors.get(edge.source)?.add(edge.target);
        neighbors.get(edge.target)?.add(edge.source);
    }
    for (const node of snapshot.nodes) {
        const previous = previousPositions.get(node.id);
        if (previous) positions.set(node.id, previous);
    }
    for (const node of snapshot.nodes) {
        if (positions.has(node.id)) continue;
        const knownNeighbors = [...(neighbors.get(node.id) ?? [])]
            .map((neighborId) => positions.get(neighborId))
            .filter((position): position is GraphPosition => Boolean(position));
        if (knownNeighbors.length === 0) continue;
        const centroid = knownNeighbors.reduce((sum, position) => ({ x: sum.x + position.x, y: sum.y + position.y }), {
            x: 0,
            y: 0,
        });
        const jitter = deterministicPosition(node.id, 0.08);
        positions.set(node.id, {
            x: centroid.x / knownNeighbors.length + jitter.x,
            y: centroid.y / knownNeighbors.length + jitter.y,
        });
    }
    for (const node of snapshot.nodes) {
        if (!positions.has(node.id)) positions.set(node.id, deterministicPosition(node.id));
    }
    return positions;
}

function deterministicPosition(nodeId: string, radius = 1): GraphPosition {
    const first = stableHash(nodeId);
    const second = stableHash(`${nodeId}\0y`);
    const angle = (first / 0xffff_ffff) * Math.PI * 2;
    const distance = radius * (0.55 + (second / 0xffff_ffff) * 0.45);
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

function stableHash(value: string): number {
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
}

function edgeLabel(edge: GraphDisplayEdgeState): string {
    const labels = [...new Set(edge.semanticEdges.map((semanticEdge) => semanticEdge.label).filter(Boolean))];
    return labels.join(", ");
}
