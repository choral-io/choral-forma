import { describe, expect, it } from "vitest";

import type { DashboardViewProjection } from "@/data/workspace-client";

import { activeGraphNodeId, mapDashboardGraphProjection } from "./graph-adapter";

describe("WebApp graph adapter", () => {
    it("maps only taxonomy-neutral node fields and preserves semantic edge details", () => {
        const mapped = mapDashboardGraphProjection(projection());

        expect(mapped.nodes[0]).toEqual({ id: "a.md", kind: "page", path: "a.md", title: "A" });
        expect(mapped.nodes[0]).not.toHaveProperty("space");
        expect(mapped.edges[0]).toEqual(
            expect.objectContaining({
                fragment: "heading",
                fragmentKind: "heading",
                intent: "link",
                referenceSource: "body",
            }),
        );
    });

    it("maps the current WebApp page route to the shared active node", () => {
        expect(activeGraphNodeId(projection(), "/pages/a")).toBe("a.md");
        expect(activeGraphNodeId(projection(), "/views/graph")).toBeNull();
    });
});

function projection(): Extract<DashboardViewProjection, { kind: "graph" }> {
    return {
        kind: "graph",
        nodes: [
            {
                id: "a.md",
                path: "a.md",
                title: "A",
                kind: "page",
                space: "not-a-built-in-classification",
                routePath: "/pages/a",
            },
            { id: "b.md", path: "b.md", title: "B", space: "another-configured-taxonomy" },
        ],
        edges: [
            {
                id: "ab",
                source: "a.md",
                target: "b.md",
                sourcePath: "a.md",
                targetPath: "b.md",
                fragment: "heading",
                fragmentKind: "heading",
                intent: "link",
                referenceSource: "body",
                label: "links to",
            },
        ],
    };
}
