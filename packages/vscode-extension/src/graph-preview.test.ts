import { describe, expect, it } from "vitest";

import { mapPreviewGraphProjection, parsePreviewGraphData } from "./graph-preview-data.ts";
import { graphSummaryPresentation, shouldScheduleGraphReconcile } from "./graph-preview-lifecycle.ts";

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

    it("does not reconcile again for its own summary or companion-list DOM writes", () => {
        const ownedTarget = {
            closest: (selector: string) => (selector.includes("data-forma-graph-summary") ? ownedTarget : undefined),
        };
        const nativePreviewTarget = { closest: () => undefined };

        expect(shouldScheduleGraphReconcile([{ target: ownedTarget }])).toBe(false);
        expect(shouldScheduleGraphReconcile([{ target: nativePreviewTarget }])).toBe(true);
    });

    it("produces a stable summary fingerprint until selection content changes", () => {
        const first = graphSummaryPresentation({ path: "notes/one.md", title: "One" }, 3);
        const repeated = graphSummaryPresentation({ path: "notes/one.md", title: "One" }, 3);
        const changed = graphSummaryPresentation({ path: "notes/one.md", title: "One" }, 4);

        expect(first?.fingerprint).toBe(repeated?.fingerprint);
        expect(changed?.fingerprint).not.toBe(first?.fingerprint);
        expect(graphSummaryPresentation(undefined, 0)).toBeUndefined();
    });
});
