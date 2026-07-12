import assert from "node:assert/strict";
import test from "node:test";

import { parseArguments, statistics } from "./performance-benchmark.mjs";

test("parses quick and baseline benchmark modes", () => {
    assert.equal(parseArguments([]).mode, "quick");
    assert.equal(parseArguments(["--mode", "baseline"]).mode, "baseline");
    assert.throws(() => parseArguments(["--mode", "unknown"]), /Unsupported/u);
    assert.throws(() => parseArguments(["--unknown"]), /Unknown/u);
});

test("calculates stable median and nearest-rank p95 statistics", () => {
    assert.deepEqual(statistics([9, 1, 5, 3, 7]), {
        samples: 5,
        minimumMs: 1,
        medianMs: 5,
        p95Ms: 9,
        maximumMs: 9,
    });
    assert.deepEqual(statistics([2]), {
        samples: 1,
        minimumMs: 2,
        medianMs: 2,
        p95Ms: 2,
        maximumMs: 2,
    });
    assert.throws(() => statistics([]), /at least one sample/u);
});
