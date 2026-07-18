import { describe, expect, it } from "vitest";

import { graphFixture, graphFixtureProfile, invalidGraphFixture } from "./fixtures.ts";
import { aggregateDisplayEdges, graphLabel, GraphViewModel, nodeSize } from "./model.ts";
import { DEFAULT_GRAPH_PRESENTATION, type GraphEdgeInput, type GraphProjection } from "./types.ts";

describe("GraphViewModel", () => {
    it("selects a node without navigating and emphasizes only its one-hop neighborhood", () => {
        const model = new GraphViewModel(projection());

        const snapshot = model.selectNode("a.md");

        expect(snapshot.selectedNodeId).toBe("a.md");
        expect(snapshot.selectionSource).toBe("user");
        expect(snapshot.adjacentNodeIds).toEqual(new Set(["b.md", "c.md"]));
        expect(Object.fromEntries(snapshot.nodes.map((node) => [node.id, node.role]))).toEqual({
            "a.md": "selected",
            "b.md": "neighbor",
            "c.md": "neighbor",
            "d.md": "muted",
        });
        expect(snapshot.edges.filter((edge) => edge.emphasized).map((edge) => edge.id)).toEqual([
            "a.md\u2192b.md",
            "a.md\u2194c.md",
        ]);
    });

    it("lets manual selection persist until the active document actually changes", () => {
        const model = new GraphViewModel(projection());

        expect(model.setActiveNode("a.md").selectedNodeId).toBe("a.md");
        expect(model.selectNode("b.md").selectedNodeId).toBe("b.md");
        expect(model.setActiveNode("a.md").selectedNodeId).toBe("b.md");

        const changed = model.setActiveNode("c.md");
        expect(changed.selectedNodeId).toBe("c.md");
        expect(changed.selectionSource).toBe("active");
    });

    it("falls back to an unselected graph for an absent or inapplicable active document", () => {
        const model = new GraphViewModel(projection());
        model.selectNode("a.md");

        const snapshot = model.setActiveNode("outside.md");

        expect(snapshot.selectedNodeId).toBeNull();
        expect(snapshot.selectionSource).toBeNull();
        expect(snapshot.nodes.every((node) => node.role === "default")).toBe(true);
    });

    it("retains a user selection across a projection refresh when the node survives", () => {
        const model = new GraphViewModel(projection());
        model.selectNode("b.md");

        const snapshot = model.replaceProjection({
            nodes: projection().nodes.filter((node) => node.id !== "d.md"),
            edges: projection().edges,
        });

        expect(snapshot.selectedNodeId).toBe("b.md");
        expect(snapshot.selectionSource).toBe("user");
    });

    it("ignores duplicate nodes and edges whose endpoints are outside the projection", () => {
        const input = projection();
        const firstNode = input.nodes[0];
        if (!firstNode) throw new Error("Expected fixture node.");
        const model = new GraphViewModel({
            nodes: [...input.nodes, firstNode],
            edges: [...input.edges, edge("outside", "a.md", "outside.md")],
        });

        const snapshot = model.snapshot();
        expect(snapshot.nodes).toHaveLength(4);
        expect(snapshot.edges).toHaveLength(3);
    });
});

describe("aggregateDisplayEdges", () => {
    it("uses one double-direction display edge while preserving reciprocal semantic edges", () => {
        const edges = [edge("forward", "a.md", "b.md"), edge("reverse", "b.md", "a.md")];

        expect(aggregateDisplayEdges(edges)).toEqual([
            {
                id: "a.md\u2194b.md",
                source: "a.md",
                target: "b.md",
                direction: "reciprocal",
                semanticEdges: edges,
            },
        ]);
    });

    it("aggregates same-direction semantic edges without inventing reciprocity", () => {
        const edges = [
            edge("body", "a.md", "b.md"),
            { ...edge("field", "a.md", "b.md"), referenceSource: "frontmatter" as const },
        ];

        expect(aggregateDisplayEdges(edges)).toEqual([
            {
                id: "a.md\u2192b.md",
                source: "a.md",
                target: "b.md",
                direction: "forward",
                semanticEdges: edges,
            },
        ]);
    });
});

describe("graph fixtures and presentation", () => {
    it("generates deterministic bounded fixtures", () => {
        expect(graphFixture(25, 50, 42)).toEqual(graphFixture(25, 50, 42));
        expect(graphFixture(25, 50, 42).nodes).toHaveLength(25);
        expect(graphFixture(25, 50, 42).edges).toHaveLength(50);
    });

    it("provides lazy empty, small, medium, large, and invalid fixture profiles", () => {
        expect(graphFixtureProfile("empty")).toEqual({ nodes: [], edges: [] });
        expect(graphFixtureProfile("small").nodes).toHaveLength(25);
        expect(graphFixtureProfile("medium").edges).toHaveLength(1_500);
        expect(graphFixtureProfile("large").nodes).toHaveLength(5_000);
        expect(new GraphViewModel(invalidGraphFixture()).snapshot().nodes).toHaveLength(2);
    });

    it("uses a bounded logarithmic degree scale", () => {
        expect(nodeSize(0, DEFAULT_GRAPH_PRESENTATION)).toBe(4);
        expect(nodeSize(3, DEFAULT_GRAPH_PRESENTATION)).toBe(6.8);
        expect(nodeSize(10_000, DEFAULT_GRAPH_PRESENTATION)).toBe(12);
    });

    it("uses a bounded shared label instead of Host-specific truncation", () => {
        expect(graphLabel("A concise title", 42)).toBe("A concise title");
        expect(graphLabel("A title that is too long", 12)).toBe("A title tha…");
    });
});

function projection(): GraphProjection {
    return {
        nodes: ["a.md", "b.md", "c.md", "d.md"].map((id) => ({ id, path: id, title: id })),
        edges: [
            edge("ab", "a.md", "b.md"),
            edge("ac", "a.md", "c.md"),
            edge("ca", "c.md", "a.md"),
            edge("bd", "b.md", "d.md"),
        ],
    };
}

function edge(id: string, source: string, target: string): GraphEdgeInput {
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
