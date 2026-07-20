import { graphExpandPresentation, graphSummaryPresentation } from "@choral-forma/graph-view/presentation";
import { describe, expect, it } from "vitest";

import { mapPreviewGraphProjection, parsePreviewGraphData } from "./graph-preview-data.ts";
import { shouldScheduleGraphReconcile } from "./graph-preview-lifecycle.ts";

describe("VS Code Graph Preview adapter", () => {
    it("maps taxonomy presentation without reading the compatibility space field", () => {
        const projection = mapPreviewGraphProjection({
            kind: "graph",
            nodes: [
                {
                    id: "notes/one.md",
                    path: "notes/one.md",
                    title: "One",
                    space: "must-not-be-used",
                    classification: { key: "areas:research", taxonomy: "areas", label: "Research" },
                },
            ],
            edges: [],
            legend: [
                {
                    key: "areas:research",
                    taxonomy: "areas",
                    label: "Research",
                    color: "#4F7CAC",
                },
            ],
        });

        expect(projection.nodes[0]).toMatchObject({
            id: "notes/one.md",
            classification: { key: "areas:research", label: "Research", color: "#4F7CAC" },
        });
        expect(projection.nodes[0]).not.toHaveProperty("space");
    });

    it("rejects malformed inert Preview data", () => {
        expect(parsePreviewGraphData("not json")).toBeUndefined();
        expect(parsePreviewGraphData('{"schemaVersion":1,"projection":{"kind":"table"}}')).toBeUndefined();
    });

    it("does not reconcile again for its own summary DOM writes", () => {
        const ownedTarget = {
            closest: (selector: string) => (selector.includes("data-forma-graph-summary") ? ownedTarget : undefined),
        };
        const nativePreviewTarget = { closest: () => undefined };

        expect(shouldScheduleGraphReconcile([{ target: ownedTarget }])).toBe(false);
        expect(shouldScheduleGraphReconcile([{ target: nativePreviewTarget }])).toBe(true);
    });

    it("consumes shared page-local expansion and selection-summary semantics", () => {
        expect(graphExpandPresentation(false).ariaLabel).toBe("Expand graph");
        expect(graphSummaryPresentation({ path: "notes/one.md", title: "One" }, 3)?.links).toBe("3 linked");
    });
});
