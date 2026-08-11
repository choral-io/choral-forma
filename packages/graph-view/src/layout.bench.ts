import { bench, describe } from "vitest";

import { graphFixtureProfile, type GraphFixtureProfile } from "./fixtures.ts";
import { buildGraphologyGraph, settleInitialLayout } from "./layout.ts";
import { GraphViewModel } from "./model.ts";
import { normalizeGraphProjection } from "./projection.ts";
import type { GraphLayoutEngine } from "./types.ts";

const profiles: readonly BenchmarkProfile[] = [
    { profile: "small", label: "25 nodes / 50 edges", engine: "force", iterations: 100 },
    { profile: "medium", label: "500 nodes / 1,500 edges", engine: "forceAtlas2", iterations: 30 },
    { profile: "large", label: "5,000 nodes / 15,000 edges", engine: "forceAtlas2", iterations: 20 },
];

describe("shared graph pipeline", () => {
    for (const { profile, label, engine, iterations } of profiles) {
        const projection = graphFixtureProfile(profile, 42);
        const snapshot = new GraphViewModel(projection).snapshot();
        const options = { iterations, time: 0 };

        bench(
            `${profile} projection normalization (${label})`,
            () => {
                normalizeGraphProjection(projection);
            },
            options,
        );

        bench(
            `${profile} model construction (${label})`,
            () => {
                new GraphViewModel(projection).snapshot();
            },
            options,
        );

        bench(
            `${profile} Graphology construction (${label})`,
            () => {
                buildGraphologyGraph(snapshot);
            },
            options,
        );

        let graph = buildGraphologyGraph(snapshot);
        bench(
            `${profile} synchronous layout (${label})`,
            () => {
                settleInitialLayout(graph, engine);
            },
            {
                ...options,
                setup: () => {
                    graph = buildGraphologyGraph(snapshot);
                },
            },
        );
    }
});

type BenchmarkProfile = {
    profile: Exclude<GraphFixtureProfile, "empty">;
    label: string;
    engine: GraphLayoutEngine;
    iterations: number;
};
