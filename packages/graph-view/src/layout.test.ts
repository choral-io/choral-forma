import { describe, expect, it, vi } from "vitest";

import { graphFixture } from "./fixtures.ts";
import {
    buildGraphologyGraph,
    GraphLayoutSession,
    graphPositions,
    resolveLayoutEngine,
    resolveLayoutIterations,
    settleInitialLayout,
} from "./layout.ts";
import { GraphViewModel } from "./model.ts";
import { DEFAULT_GRAPH_LAYOUT_OPTIONS, type GraphPosition } from "./types.ts";

describe("graph layout", () => {
    it("selects a deterministic iteration budget by graph size", () => {
        expect(resolveLayoutIterations(64)).toBe(80);
        expect(resolveLayoutIterations(65)).toBe(128);
        expect(resolveLayoutIterations(500)).toBe(128);
        expect(resolveLayoutIterations(501)).toBe(64);
        expect(resolveLayoutIterations(2_000)).toBe(64);
        expect(resolveLayoutIterations(2_001)).toBe(32);
        expect(resolveLayoutIterations(5_000)).toBe(32);
    });

    it("selects a bounded main-thread layout by graph size", () => {
        expect(resolveLayoutEngine("auto", 64)).toBe("force");
        expect(resolveLayoutEngine("auto", 65)).toBe("forceAtlas2");
        expect(resolveLayoutEngine("force", 5_000)).toBe("force");
    });

    it("produces deterministic coordinates for both initial layout engines", () => {
        const snapshot = new GraphViewModel(graphFixture(25, 50, 42)).snapshot();

        for (const engine of ["force", "forceAtlas2"] as const) {
            const first = buildGraphologyGraph(snapshot);
            const second = buildGraphologyGraph(snapshot);
            settleInitialLayout(first, engine);
            settleInitialLayout(second, engine);
            expect(graphPositions(first)).toEqual(graphPositions(second));
            expect([...graphPositions(first).values()].every(isFinitePosition)).toBe(true);
        }
    });

    it("reuses surviving coordinates and seeds new nodes near known neighbors", () => {
        const initialSnapshot = new GraphViewModel(graphFixture(3, 2, 7)).snapshot();
        const initialGraph = buildGraphologyGraph(initialSnapshot);
        const initialPositions = graphPositions(initialGraph);
        const anchor = initialSnapshot.nodes[0];
        if (!anchor) throw new Error("Expected fixture node.");
        const nextSnapshot = new GraphViewModel({
            nodes: [...initialSnapshot.nodes, { id: "new.md", path: "new.md" }],
            edges: [
                ...initialSnapshot.edges.flatMap((edge) => edge.semanticEdges),
                {
                    id: "new-edge",
                    source: anchor.id,
                    target: "new.md",
                    sourcePath: anchor.path,
                    targetPath: "new.md",
                    intent: "link",
                    referenceSource: "body",
                    label: "links to",
                },
            ],
        }).snapshot();

        const nextPositions = graphPositions(buildGraphologyGraph(nextSnapshot, initialPositions));

        expect(nextPositions.get(anchor.id)).toEqual(initialPositions.get(anchor.id));
        expect(distance(nextPositions.get(anchor.id), nextPositions.get("new.md"))).toBeLessThan(0.12);
    });

    it("encodes reciprocal display edges with the double-arrow program", () => {
        const snapshot = new GraphViewModel({
            nodes: [
                { id: "a.md", path: "a.md" },
                { id: "b.md", path: "b.md" },
            ],
            edges: [edge("ab", "a.md", "b.md"), edge("ba", "b.md", "a.md")],
        }).snapshot();

        const graph = buildGraphologyGraph(snapshot);

        expect(graph.size).toBe(1);
        expect(graph.getEdgeAttribute("a.md↔b.md", "type")).toBe("doubleArrow");
    });
});

describe("GraphLayoutSession", () => {
    it("stops and kills a ForceAtlas2 worker on destroy", () => {
        const graph = buildGraphologyGraph(new GraphViewModel(graphFixture(4, 4)).snapshot());
        const supervisor = { start: vi.fn(), stop: vi.fn(), kill: vi.fn() };
        const session = new GraphLayoutSession(
            graph,
            { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, engine: "forceAtlas2" },
            {
                createSupervisor: () => supervisor,
            },
        );

        session.destroy();

        expect(supervisor.start).toHaveBeenCalledOnce();
        expect(supervisor.stop).toHaveBeenCalledOnce();
        expect(supervisor.kill).toHaveBeenCalledOnce();
    });

    it("settles a Worker after its fixed iteration budget", async () => {
        const graph = buildGraphologyGraph(new GraphViewModel(graphFixture(4, 4)).snapshot());
        const supervisor = { start: vi.fn(), stop: vi.fn(), kill: vi.fn() };
        const onSettled = vi.fn();
        let onIteration: (() => void) | undefined;
        const session = new GraphLayoutSession(
            graph,
            { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, engine: "forceAtlas2", iterations: 3, onSettled },
            {
                createSupervisor: (_graph, _settings, callback) => {
                    onIteration = callback;
                    return supervisor;
                },
            },
        );

        onIteration?.();
        onIteration?.();
        expect(onSettled).not.toHaveBeenCalled();
        onIteration?.();
        await Promise.resolve();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(supervisor.stop).toHaveBeenCalledOnce();
        expect(supervisor.kill).toHaveBeenCalledOnce();
        session.destroy();
    });

    it("cooperatively settles a large non-Worker layout in scheduled chunks", () => {
        const graph = buildGraphologyGraph(new GraphViewModel(graphFixture(501, 1_500)).snapshot());
        const onSettled = vi.fn();
        const cancel = vi.fn();
        let nextChunk: (() => void) | undefined;
        const timer = setTimeout(() => undefined, 60_000);
        const session = new GraphLayoutSession(
            graph,
            { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, engine: "forceAtlas2", useWorker: false, iterations: 24, onSettled },
            {
                createSupervisor: vi.fn(),
                schedule: (callback) => {
                    nextChunk = callback;
                    return timer;
                },
                cancel,
            },
        );

        expect(onSettled).not.toHaveBeenCalled();
        nextChunk?.();
        expect(onSettled).not.toHaveBeenCalled();
        nextChunk?.();
        nextChunk?.();
        expect(onSettled).toHaveBeenCalledOnce();
        expect(cancel).not.toHaveBeenCalled();
        session.destroy();
        clearTimeout(timer);
    });

    it("does not create a worker in reduced-motion mode", () => {
        const graph = buildGraphologyGraph(new GraphViewModel(graphFixture(4, 4)).snapshot());
        const createSupervisor = vi.fn();

        new GraphLayoutSession(
            graph,
            { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, engine: "forceAtlas2", reducedMotion: true },
            {
                createSupervisor,
            },
        ).destroy();

        expect(createSupervisor).not.toHaveBeenCalled();
    });

    it("supports hosts whose content security policy disables workers", () => {
        const graph = buildGraphologyGraph(new GraphViewModel(graphFixture(500, 1_500)).snapshot());
        const createSupervisor = vi.fn();

        new GraphLayoutSession(
            graph,
            { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, engine: "forceAtlas2", useWorker: false },
            {
                createSupervisor,
            },
        ).destroy();

        expect(createSupervisor).not.toHaveBeenCalled();
    });

    it("skips both synchronous and Worker layout for a coordinate-preserving refresh", () => {
        const graph = buildGraphologyGraph(new GraphViewModel(graphFixture(500, 1_500)).snapshot());
        const positions = graphPositions(graph);
        const createSupervisor = vi.fn();

        new GraphLayoutSession(
            graph,
            { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, engine: "forceAtlas2", runLayout: false },
            {
                createSupervisor,
            },
        ).destroy();

        expect(createSupervisor).not.toHaveBeenCalled();
        expect(graphPositions(graph)).toEqual(positions);
    });

    it("reports bounded Worker settling without firing after explicit disposal", async () => {
        const graph = buildGraphologyGraph(new GraphViewModel(graphFixture(4, 4)).snapshot());
        const supervisor = { start: vi.fn(), stop: vi.fn(), kill: vi.fn() };
        const onSettled = vi.fn();
        let onIteration: (() => void) | undefined;
        const session = new GraphLayoutSession(
            graph,
            { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, engine: "forceAtlas2", iterations: 1, onSettled },
            {
                createSupervisor: (_graph, _settings, callback) => {
                    onIteration = callback;
                    return supervisor;
                },
            },
        );

        onIteration?.();
        await Promise.resolve();
        session.destroy();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(supervisor.stop).toHaveBeenCalledOnce();
        expect(supervisor.kill).toHaveBeenCalledOnce();
    });
});

function isFinitePosition(position: GraphPosition): boolean {
    return Number.isFinite(position.x) && Number.isFinite(position.y);
}

function distance(left: GraphPosition | undefined, right: GraphPosition | undefined): number {
    if (!left || !right) return Number.POSITIVE_INFINITY;
    return Math.hypot(left.x - right.x, left.y - right.y);
}

function edge(id: string, source: string, target: string) {
    return {
        id,
        source,
        target,
        sourcePath: source,
        targetPath: target,
        intent: "link" as const,
        referenceSource: "body" as const,
        label: "links to",
    };
}
