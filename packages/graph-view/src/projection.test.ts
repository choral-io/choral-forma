import { describe, expect, it } from "vitest";

import { normalizeGraphProjection } from "./projection.ts";

describe("normalizeGraphProjection", () => {
    it("normalizes Host projections without compatibility or routing fields", () => {
        const source = {
            legend: [{ key: "areas:research", label: "Research", color: "#4f7cac" }],
            nodes: [
                {
                    id: "notes/one.md",
                    path: "notes/one.md",
                    title: "One",
                    kind: "page",
                    classification: { key: "areas:research", label: "Research" },
                    space: "compatibility-only",
                    routePath: "/pages/one",
                },
            ],
            edges: [],
        };
        const projection = normalizeGraphProjection(source);

        expect(projection.nodes[0]).toEqual({
            id: "notes/one.md",
            path: "notes/one.md",
            title: "One",
            kind: "page",
            classification: { key: "areas:research", label: "Research", color: "#4f7cac" },
        });
        expect(projection.nodes[0]).not.toHaveProperty("space");
        expect(projection.nodes[0]).not.toHaveProperty("routePath");
    });
});
