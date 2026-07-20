import { graphFixtureProfile, type GraphFixtureProfile } from "@choral-forma/graph-view/fixtures";
import type { ViewRenderOutput } from "@choral-forma/shared";
import { describe, expect, it } from "vitest";

import type { DashboardViewProjection } from "@/data/workspace-client";

import { mapPreviewGraphProjection } from "../../../../vscode-extension/src/graph-preview-data.ts";
import { mapDashboardGraphProjection } from "./graph-adapter";

type GraphRenderOutput = Extract<ViewRenderOutput, { kind: "graph" }>;
type DashboardGraphProjection = Extract<DashboardViewProjection, { kind: "graph" }>;

describe("Graph adapter parity", () => {
    for (const profile of ["empty", "small", "medium", "large"] as const) {
        it(`normalizes the ${profile} fixture identically in WebApp and VS Code`, () => {
            const render = renderProjection(profile);

            expect(mapDashboardGraphProjection(dashboardProjection(render))).toEqual(mapPreviewGraphProjection(render));
        });
    }
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

function dashboardProjection(render: GraphRenderOutput): DashboardGraphProjection {
    return {
        kind: "graph",
        legend: render.legend ?? [],
        nodes: render.nodes.map((node) => ({
            ...node,
            title: node.title ?? node.path,
            routePath: `/pages/${encodeURIComponent(node.path)}`,
        })),
        edges: render.edges.map((edge) => ({ ...edge })),
    };
}
