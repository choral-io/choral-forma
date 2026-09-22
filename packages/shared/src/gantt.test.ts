import { expect, it } from "vitest";
import fixture from "./fixtures/gantt-core.json";
import { ganttDependencySummary, ganttRowLabel, type GanttProjection } from "./gantt";

it("consumes a Core-generated projection with stable identities and explicit dependency counts", () => {
    // Captured from the getting-started workspace via forma view render .forma/views/gantt.
    const projection = fixture as GanttProjection;
    expect(projection.kind).toBe("gantt");
    expect(projection.nodes).toHaveLength(projection.counts.candidates);
    expect(projection.rows).toHaveLength(projection.counts.scheduled);
    const row = projection.rows[0];
    if (!row) throw new Error("fixture must have rows");
    expect(ganttRowLabel(row, projection.timeZone, "en")).toBe("2026-06-01 · All day");
    for (const node of projection.nodes) {
        const d = node.dependencies;
        expect(d.declared).toBe(
            d.predecessors.length + d.outsideSelection + d.unresolved + d.duplicates + d.selfReferences,
        );
        expect(ganttDependencySummary(d)).toContain("outside selection");
    }
    for (const edge of projection.edges) expect(JSON.parse(edge.id)).toEqual([edge.from, edge.to]);
});
