import assert from "node:assert/strict";
import test from "node:test";
import {
    markdownBrowserPhases,
    parseMarkdownBrowserPhase,
    validateMarkdownBrowserPhase,
} from "./markdown-browser-protocol.mjs";

const phase = { name: "static", expectedResults: ["image checks", "P1 checks", "raw checks"] };
const report = (results) => ({ status: "FORMA_MARKDOWN_BROWSER_PASSED", results });
test("accepts all required checks", () => {
    assert.deepEqual(validateMarkdownBrowserPhase(report(phase.expectedResults), phase).results, phase.expectedResults);
});
for (const [name, results] of [
    ["missing check", ["image checks", "P1 checks"]],
    ["duplicate check", ["image checks", "P1 checks", "P1 checks"]],
    ["wrong phase", ["other host checks"]],
    ["unexpected check", [...phase.expectedResults, "unknown check"]],
    ["empty report", []],
])
    test(`rejects ${name}`, () => assert.throws(() => validateMarkdownBrowserPhase(report(results), phase)));

test("rejects wrong status and malformed result shapes", () => {
    for (const result of [
        null,
        {},
        { results: phase.expectedResults },
        { status: "failed", results: phase.expectedResults },
        { status: "FORMA_MARKDOWN_BROWSER_PASSED", results: "checks" },
    ])
        assert.throws(() => validateMarkdownBrowserPhase(result, phase));
});

const sourceIds = {
    reading: Array.from({ length: 56 }, (_, i) => `reading-${i}`),
    callouts: Array.from({ length: 14 }, (_, i) => `callout-${i}`),
    disclosures: ["first", "second"],
};
test("plans isolated disclosure and existing regression coverage for every host", () => {
    const phases = markdownBrowserPhases([{ name: "static" }, { name: "webapp" }], sourceIds);
    assert.deepEqual(
        phases.map(({ name, mode, expectedResults }) => [name, mode, expectedResults.length]),
        [
            ["webapp-disclosures", "disclosures", 1],
            ["static-disclosures", "disclosures", 1],
            ["noscript-disclosures", "disclosures", 1],
            ["webapp", "enhanced", 7],
            ["static", "enhanced", 8],
            ["noscript", "noscript", 5],
        ],
    );
    assert.deepEqual(
        phases.map((p) => p.hosts[0].name),
        ["webapp", "static", "static", "webapp", "static", "static"],
    );
    assert.deepEqual(
        phases.slice(0, 3).map((p) => p.noScript),
        [false, false, true],
    );
    const coverage = phases.flatMap((p) => p.expectedResults);
    assert.equal(coverage.length, 23);
    assert.equal(new Set(coverage).size, 23);
    for (const phase of phases) {
        assert.deepEqual(
            validateMarkdownBrowserPhase(
                { ...report(phase.expectedResults), sourceCases: phase.expectedSourceCases },
                phase,
            ).results,
            phase.expectedResults,
        );
        assert.throws(() => validateMarkdownBrowserPhase(report(phase.expectedResults.slice(1)), phase));
    }
    for (const family of Object.keys(sourceIds)) {
        for (const ids of [undefined, null, [], Array(1), ["a", "a"], [""], [12]])
            assert.throws(() =>
                markdownBrowserPhases([{ name: "webapp" }, { name: "static" }], { ...sourceIds, [family]: ids }),
            );
    }
    assert.throws(() =>
        markdownBrowserPhases([{ name: "webapp" }, { name: "static" }], { ...sourceIds, unknown: ["x"] }),
    );
    for (const hosts of [
        [],
        [{ name: "webapp" }],
        [{ name: "webapp" }, { name: "webapp" }],
        [{ name: "webapp" }, { name: "other" }],
    ])
        assert.throws(() => markdownBrowserPhases(hosts, sourceIds));
});
test("rejects ambiguous, malformed and error-bearing CLI output", () => {
    const output = `### Result\n${JSON.stringify(report(phase.expectedResults))}\n`;
    assert.deepEqual(parseMarkdownBrowserPhase(output, phase).results, phase.expectedResults);
    for (const malformed of ["", "### Result\n{invalid}\n", output + output, `### Error\nfailed\n${output}`])
        assert.throws(() => parseMarkdownBrowserPhase(malformed, phase));
});

test("requires every source-case journal before accepting a phase", () => {
    for (const family of ["reading", "callouts", "disclosures"]) {
        const phase = {
            name: family,
            expectedResults: ["checks"],
            expectedSourceCases: { [family]: ["first", "second"] },
        };
        assert.deepEqual(
            validateMarkdownBrowserPhase(
                { ...report(phase.expectedResults), sourceCases: phase.expectedSourceCases },
                phase,
            ).sourceCases,
            phase.expectedSourceCases,
        );
        for (const ids of [undefined, [], ["first"], ["first", "first"], ["second", "first"], ["first", "other"]])
            assert.throws(() =>
                validateMarkdownBrowserPhase(
                    { ...report(phase.expectedResults), sourceCases: { [family]: ids } },
                    phase,
                ),
            );
    }
});
test("rejects incomplete reading and callout source-case coverage", () => {
    const phase = {
        name: "webapp",
        expectedResults: ["checks"],
        expectedSourceCases: { reading: ["r"], callouts: ["c"] },
    };
    assert.deepEqual(
        validateMarkdownBrowserPhase(
            { ...report(phase.expectedResults), sourceCases: { callouts: ["c"], reading: ["r"] } },
            phase,
        ).results,
        phase.expectedResults,
    );
    for (const sourceCases of [
        undefined,
        { reading: ["r"] },
        { reading: ["r"], callouts: [] },
        { reading: ["r"], callouts: ["c"], extra: [] },
    ])
        assert.throws(() => validateMarkdownBrowserPhase({ ...report(phase.expectedResults), sourceCases }, phase));
});
