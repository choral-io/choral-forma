import { describe, expect, it } from "vitest";

import type { DashboardViewProjection } from "@/data/workspace-client";

import { activeGraphNodeId, mapDashboardGraphProjection } from "./graph-adapter";

describe("WebApp graph adapter", () => {
    it("maps taxonomy-neutral classification and preserves semantic edge details", () => {
        const mapped = mapDashboardGraphProjection(projection());

        expect(mapped.nodes[0]).toEqual({
            id: "a.md",
            kind: "page",
            path: "a.md",
            title: "A",
            classification: {
                key: "areas:term:research",
                label: "Research",
                color: "#a855f7",
            },
        });
        expect(mapped.nodes[0]).not.toHaveProperty("space");
        expect(mapped.legend).toEqual([{ key: "areas:term:research", label: "Research", color: "#a855f7" }]);
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

    it("maps field-driven colors through the shared projection", () => {
        const source = projection();
        source.legend = [
            {
                key: "field:fields.status:value:doing",
                field: "fields.status",
                label: "doing",
                color: "#2563EB",
            },
        ];
        const firstNode = source.nodes[0];
        if (!firstNode) throw new Error("expected graph fixture node");
        firstNode.classification = {
            key: "field:fields.status:value:doing",
            field: "fields.status",
            label: "doing",
        };

        expect(mapDashboardGraphProjection(source).nodes[0]?.classification).toEqual({
            key: "field:fields.status:value:doing",
            label: "doing",
            color: "#2563EB",
        });
    });
});

function projection(): Extract<DashboardViewProjection, { kind: "graph" }> {
    return {
        kind: "graph",
        legend: [
            {
                key: "areas:term:research",
                taxonomy: "areas",
                terms: ["research"],
                label: "Research",
                color: "#a855f7",
            },
        ],
        nodes: [
            {
                id: "a.md",
                path: "a.md",
                title: "A",
                kind: "page",
                space: "not-a-built-in-classification",
                routePath: "/pages/a",
                classification: {
                    key: "areas:term:research",
                    taxonomy: "areas",
                    terms: ["research"],
                    label: "Research",
                },
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
