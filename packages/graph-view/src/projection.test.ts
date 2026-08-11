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

    it("normalizes field-driven colors without interpreting their source metadata", () => {
        const projection = normalizeGraphProjection({
            legend: [
                {
                    key: "field:fields.status:value:doing",
                    label: "doing",
                    color: "#2563EB",
                    field: "fields.status",
                },
            ],
            nodes: [
                {
                    id: "tasks/one.md",
                    path: "tasks/one.md",
                    classification: {
                        key: "field:fields.status:value:doing",
                        label: "doing",
                        field: "fields.status",
                    },
                },
            ],
            edges: [],
        });

        expect(projection.nodes[0]?.classification).toEqual({
            key: "field:fields.status:value:doing",
            label: "doing",
            color: "#2563EB",
        });
    });
});
