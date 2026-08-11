import type { GraphEdgeInput, GraphNodeInput, GraphProjection } from "./types.ts";

export type GraphFixtureProfile = "empty" | "small" | "medium" | "large";

export const GRAPH_FIXTURE_SIZES: Readonly<Record<GraphFixtureProfile, Readonly<{ nodes: number; edges: number }>>> =
    Object.freeze({
        empty: { nodes: 0, edges: 0 },
        small: { nodes: 25, edges: 50 },
        medium: { nodes: 500, edges: 1_500 },
        large: { nodes: 5_000, edges: 15_000 },
    });

export function graphFixtureProfile(profile: GraphFixtureProfile, seed = 1): GraphProjection {
    const size = GRAPH_FIXTURE_SIZES[profile];
    return graphFixture(size.nodes, size.edges, seed);
}

export function invalidGraphFixture(): GraphProjection {
    const valid = graphFixture(2, 1, 1);
    const firstNode = valid.nodes[0];
    return {
        nodes: firstNode ? [...valid.nodes, firstNode] : valid.nodes,
        edges: [
            ...valid.edges,
            {
                id: "invalid-outside-edge",
                source: firstNode?.id ?? "missing-source.md",
                target: "missing-target.md",
                sourcePath: firstNode?.path ?? "missing-source.md",
                targetPath: "missing-target.md",
                intent: "link",
                referenceSource: "body",
                label: "invalid fixture edge",
            },
        ],
    };
}

export function semanticGraphFixture(): GraphProjection {
    const firstId = "notes/semantic-source.md";
    const secondId = "notes/semantic-target.md";
    return {
        legend: [{ key: "areas:research", label: "Research", color: "#4f7cac" }],
        nodes: [
            {
                id: firstId,
                path: firstId,
                title: "A deliberately long graph label that must use the shared truncation policy",
                kind: "page",
                classification: { key: "areas:research", label: "Research", color: "#4f7cac" },
            },
            { id: secondId, path: secondId, title: "Semantic target", kind: "page" },
        ],
        edges: [
            graphEdge("semantic-forward", firstId, secondId),
            graphEdge("semantic-reverse", secondId, firstId),
            graphEdge("semantic-unresolved", firstId, "notes/missing-target.md"),
        ],
    };
}

export function graphFixture(nodeCount: number, edgeCount: number, seed = 1): GraphProjection {
    const nodes = Array.from({ length: nodeCount }, (_value, index): GraphNodeInput => {
        const id = `notes/node-${String(index + 1).padStart(4, "0")}.md`;
        return { id, path: id, title: `Node ${String(index + 1)}`, kind: "page" };
    });
    if (nodes.length === 0) return { nodes, edges: [] };

    const random = seededRandom(seed);
    const edges: GraphEdgeInput[] = [];
    const seen = new Set<string>();
    const maximumEdges = nodeCount * Math.max(0, nodeCount - 1);
    const targetEdgeCount = Math.min(edgeCount, maximumEdges);
    while (edges.length < targetEdgeCount) {
        const sourceIndex = Math.floor(random() * nodeCount);
        let targetIndex = Math.floor(random() * nodeCount);
        if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % nodeCount;
        const source = nodes[sourceIndex];
        const target = nodes[targetIndex];
        if (!source || !target) continue;
        const id = `${source.id}->${target.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        edges.push({
            id,
            source: source.id,
            target: target.id,
            sourcePath: source.path,
            targetPath: target.path,
            intent: "link",
            referenceSource: "body",
            label: "links to",
        });
    }
    return { nodes, edges };
}

function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        return state / 0x1_0000_0000;
    };
}

function graphEdge(id: string, source: string, target: string): GraphEdgeInput {
    return {
        id,
        source,
        target,
        sourcePath: source,
        targetPath: target,
        intent: "link",
        referenceSource: "body",
        label: "links to",
    };
}
