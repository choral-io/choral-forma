import { MultiDirectedGraph } from "graphology";
import forceLayout from "graphology-layout-force";
import forceAtlas2, { type ForceAtlas2Settings } from "graphology-layout-forceatlas2";
import ForceAtlas2LayoutSupervisor from "graphology-layout-forceatlas2/worker";

import type {
    GraphDisplayEdgeState,
    GraphLayoutEngine,
    GraphLayoutOptions,
    GraphLayoutSettleMode,
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
    createSupervisor: (
        graph: GraphologyViewGraph,
        settings: ForceAtlas2Settings,
        onIteration: () => void,
    ) => LayoutSupervisor;
    schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
    cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

type GraphLayoutSessionOptions = GraphLayoutOptions & {
    onSettled?: (mode: GraphLayoutSettleMode) => void;
    runLayout?: boolean;
};

const DEFAULT_DEPENDENCIES: LayoutSessionDependencies = {
    createSupervisor: (graph, settings, onIteration) => {
        const supervisor = new ForceAtlas2LayoutSupervisor(graph, { settings });
        graph.on("eachNodeAttributesUpdated", onIteration);
        return {
            start: () => {
                supervisor.start();
            },
            stop: () => {
                supervisor.stop();
            },
            kill: () => {
                graph.removeListener("eachNodeAttributesUpdated", onIteration);
                supervisor.kill();
            },
        };
    },
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

export function settleInitialLayout(
    graph: GraphologyViewGraph,
    requestedEngine: GraphLayoutEngine,
    requestedIterations?: number,
): GraphLayoutEngine {
    const engine = resolveLayoutEngine(requestedEngine, graph.order);
    if (graph.order < 2 || graph.size === 0) return engine;
    const iterations = requestedIterations ?? resolveLayoutIterations(graph.order);
    runLayoutIterations(graph, engine, iterations);
    return engine;
}

export function resolveLayoutEngine(requestedEngine: GraphLayoutEngine, nodeCount: number): GraphLayoutEngine {
    return requestedEngine === "auto" ? (nodeCount <= 64 ? "force" : "forceAtlas2") : requestedEngine;
}

export function resolveLayoutIterations(nodeCount: number): number {
    if (nodeCount <= 64) return Math.min(80, 24 + Math.max(0, nodeCount));
    if (nodeCount <= 500) return 128;
    if (nodeCount <= 2_000) return 64;
    return 32;
}

export function graphPositions(graph: GraphologyViewGraph): ReadonlyMap<string, GraphPosition> {
    return new Map(graph.mapNodes((node, attributes) => [node, { x: attributes.x, y: attributes.y }] as const));
}

export class GraphLayoutSession {
    readonly #onSettled: ((mode: GraphLayoutSettleMode) => void) | undefined;
    #supervisor: LayoutSupervisor | null = null;
    #timer: ReturnType<typeof setTimeout> | null = null;
    #iterationCount = 0;
    #targetIterations = 0;
    #finishScheduled = false;
    #settled = false;
    #disposed = false;
    readonly #dependencies: LayoutSessionDependencies;
    readonly #mode: GraphLayoutSettleMode;
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
            this.#mode = "synchronous";
            this.#settled = true;
            return;
        }
        const engine = resolveLayoutEngine(options.engine, graph.order);
        const workerEligible = !(
            options.reducedMotion ||
            !options.useWorker ||
            engine !== "forceAtlas2" ||
            graph.order < 2 ||
            graph.size === 0
        );
        const iterations = options.iterations ?? resolveLayoutIterations(graph.order);
        this.#usesWorker = workerEligible && iterations > 0;
        this.#mode = this.#usesWorker
            ? "worker"
            : shouldUseCooperativeLayout(options, engine, graph.order, iterations)
              ? "cooperative"
              : "synchronous";
        if (this.#mode === "synchronous") {
            if (iterations > 0) settleInitialLayout(graph, engine, iterations);
            this.#settled = true;
            return;
        }
        this.#targetIterations = iterations;
        if (this.#mode === "cooperative") {
            this.#scheduleCooperativeChunk(graph, engine);
            return;
        }
        this.#supervisor = dependencies.createSupervisor(graph, forceAtlas2Settings(graph.order), () => {
            this.#iterationCount += 1;
            if (this.#iterationCount >= iterations) this.#scheduleFinish();
        });
        this.#supervisor.start();
    }

    get usesWorker(): boolean {
        return this.#usesWorker;
    }

    get isSettled(): boolean {
        return this.#settled;
    }

    get mode(): GraphLayoutSettleMode {
        return this.#mode;
    }

    stop(): void {
        if (this.#timer) {
            (this.#dependencies.cancel ?? clearTimeout)(this.#timer);
            this.#timer = null;
        }
        if (this.#supervisor) {
            this.#supervisor.stop();
            this.#supervisor.kill();
            this.#supervisor = null;
        }
    }

    destroy(): void {
        this.#disposed = true;
        this.stop();
    }

    #scheduleFinish(): void {
        if (this.#finishScheduled) return;
        this.#finishScheduled = true;
        queueMicrotask(() => {
            this.#finishScheduled = false;
            this.#finish();
        });
    }

    #finish(): void {
        if (this.#disposed || this.#settled) return;
        this.#settled = true;
        this.stop();
        this.#onSettled?.(this.#mode);
    }

    #scheduleCooperativeChunk(graph: GraphologyViewGraph, engine: GraphLayoutEngine): void {
        this.#timer = (this.#dependencies.schedule ?? setTimeout)(() => {
            this.#timer = null;
            const chunk = Math.min(this.#targetIterations - this.#iterationCount, cooperativeChunkSize(graph.order));
            runLayoutIterations(graph, engine, chunk);
            this.#iterationCount += chunk;
            if (this.#iterationCount >= this.#targetIterations) this.#finish();
            else this.#scheduleCooperativeChunk(graph, engine);
        }, 0);
    }
}

function runLayoutIterations(graph: GraphologyViewGraph, engine: GraphLayoutEngine, iterations: number): void {
    if (iterations <= 0 || graph.order < 2 || graph.size === 0) return;
    if (engine === "force") {
        forceLayout.assign(graph, {
            maxIterations: Math.min(iterations, 80),
            settings: { attraction: 0.0008, gravity: 0.002, inertia: 0.5, maxMove: 24, repulsion: 0.12 },
        });
    } else {
        forceAtlas2.assign(graph, {
            iterations,
            settings: forceAtlas2Settings(graph.order),
        });
    }
}

function shouldUseCooperativeLayout(
    options: GraphLayoutSessionOptions,
    engine: GraphLayoutEngine,
    nodeCount: number,
    iterations: number,
): boolean {
    return (
        !options.useWorker && !options.reducedMotion && engine === "forceAtlas2" && nodeCount > 500 && iterations > 0
    );
}

function cooperativeChunkSize(nodeCount: number): number {
    return nodeCount > 2_000 ? 1 : 8;
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
