import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { classifyAcknowledgement } from "../src/ack-window.mjs";

function load(relativePath) {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

function evaluate(configPath, inputPath) {
    const config = load(configPath);
    const input = load(inputPath);
    return input.cases.map((event) => ({
        id: event.id,
        actual: classifyAcknowledgement(event, config).decision,
        expected: event.expected,
    }));
}

test("staging profile passes all cases", () => {
    const results = evaluate("../config/staging.json", "../fixtures/staging-events.json");
    assert.equal(results.filter((result) => result.actual === result.expected).length, 4);
});

test("production naive profile exposes both counterexamples", () => {
    const results = evaluate("../config/production-naive.json", "../fixtures/production-events.json");
    assert.equal(results.filter((result) => result.actual !== result.expected).length, 2);
});

test("adjusted production profile passes all cases", () => {
    const results = evaluate("../config/production-adjusted.json", "../fixtures/production-events.json");
    assert.equal(results.filter((result) => result.actual === result.expected).length, 4);
});

test("the exact window boundary is accepted and a late event is rejected", () => {
    const config = load("../config/staging.json");
    assert.equal(
        classifyAcknowledgement({ id: "boundary", delaySeconds: 120, replayed: false }, config).decision,
        "accepted",
    );
    assert.equal(
        classifyAcknowledgement({ id: "late", delaySeconds: 121, replayed: false }, config).decision,
        "rejected",
    );
});
