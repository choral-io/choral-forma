import { describe, test } from "vitest";

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

        test(`${profile} projection normalization (${label})`, async ({ bench }) => {
            await bench("normalize", () => normalizeGraphProjection(projection)).run(options);
        });

        test(`${profile} model construction (${label})`, async ({ bench }) => {
            await bench("model", () => new GraphViewModel(projection).snapshot()).run(options);
        });

        test(`${profile} Graphology construction (${label})`, async ({ bench }) => {
            await bench("graph", () => buildGraphologyGraph(snapshot)).run(options);
        });

        test(`${profile} synchronous layout (${label})`, async ({ bench }) => {
            let graph = buildGraphologyGraph(snapshot);
            await bench(
                "layout",
                {
                    beforeEach: () => {
                        graph = buildGraphologyGraph(snapshot);
                    },
                },
                () => settleInitialLayout(graph, engine),
            ).run(options);
        });
    }
});

type BenchmarkProfile = {
    profile: Exclude<GraphFixtureProfile, "empty">;
    label: string;
    engine: GraphLayoutEngine;
    iterations: number;
};
