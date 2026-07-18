import { bench, describe } from "vitest";

import { graphFixtureProfile } from "./fixtures.ts";
import { buildGraphologyGraph, settleInitialLayout } from "./layout.ts";
import { GraphViewModel } from "./model.ts";

const small = new GraphViewModel(graphFixtureProfile("small", 42)).snapshot();
const medium = new GraphViewModel(graphFixtureProfile("medium", 42)).snapshot();
const large = new GraphViewModel(graphFixtureProfile("large", 42)).snapshot();

describe("shared graph layout", () => {
    bench(
        "small force layout (25 nodes / 50 edges)",
        () => {
            settleInitialLayout(buildGraphologyGraph(small), "force");
        },
        { iterations: 5, time: 0 },
    );

    bench(
        "medium ForceAtlas2 seed (500 nodes / 1,500 edges)",
        () => {
            settleInitialLayout(buildGraphologyGraph(medium), "forceAtlas2");
        },
        { iterations: 3, time: 0 },
    );

    bench(
        "large deterministic worker seed (5,000 nodes / 15,000 edges)",
        () => {
            settleInitialLayout(buildGraphologyGraph(large), "forceAtlas2");
        },
        { iterations: 2, time: 0 },
    );
});
