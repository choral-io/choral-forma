import { graphFixtureProfile, semanticGraphFixture, type GraphFixtureProfile } from "@choral-forma/graph-view/fixtures";
import { graphExpandPresentation, graphSummaryPresentation } from "@choral-forma/graph-view/presentation";
import { normalizeGraphProjection } from "@choral-forma/graph-view/projection";
import { describe, expect, it } from "vitest";

import { mapPreviewGraphProjection, parsePreviewGraphData, type GraphRenderOutput } from "./graph-preview-data.ts";
import { shouldScheduleGraphReconcile } from "./graph-preview-lifecycle.ts";

describe("VS Code Graph Preview adapter", () => {
    for (const profile of ["empty", "small", "medium", "large"] as const) {
        it(`normalizes the ${profile} fixture identically to the shared Graph projection`, () => {
            const render = renderProjection(profile);

            expect(mapPreviewGraphProjection(render)).toEqual(normalizeGraphProjection(render));
        });
    }

    it("preserves explicit semantic edge cases through the VS Code adapter", () => {
        const render = semanticRenderProjection();

        expect(mapPreviewGraphProjection(render)).toEqual(normalizeGraphProjection(render));
    });

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

function renderProjection(profile: GraphFixtureProfile): GraphRenderOutput {
    const fixture = graphFixtureProfile(profile, 42);
    return {
        kind: "graph",
        legend: [{ key: "areas:research", taxonomy: "areas", label: "Research", color: "#4f7cac" }],
        nodes: fixture.nodes.map((node, index) => ({
            id: node.id,
            path: node.path,
            space: "compatibility-only",
            ...(node.title ? { title: node.title } : {}),
            ...(node.kind ? { kind: node.kind } : {}),
            ...(index % 3 === 0
                ? {
                      classification: {
                          key: "areas:research",
                          taxonomy: "areas",
                          label: "Research",
                      },
                  }
                : {}),
        })),
        edges: fixture.edges.map((edge) => ({ ...edge })),
    };
}

function semanticRenderProjection(): GraphRenderOutput {
    const fixture = semanticGraphFixture();
    return {
        kind: "graph",
        legend: (fixture.legend ?? []).map((item) => ({ ...item, taxonomy: "areas" })),
        nodes: fixture.nodes.map(({ classification, ...node }) => ({
            ...node,
            space: "semantic-fixture",
            ...(classification ? { classification: { ...classification, taxonomy: "areas" } } : {}),
        })),
        edges: fixture.edges.map((edge) => ({ ...edge })),
    };
}
