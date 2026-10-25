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

test("plans every host and the scripts-disabled host exactly once", () => {
    const phases = markdownBrowserPhases([{ name: "static" }, { name: "webapp" }], 56, 14);
    assert.deepEqual(
        phases.map(({ name, mode, expectedResults }) => [name, mode, expectedResults.length]),
        [
            ["webapp", "enhanced", 7],
            ["static", "enhanced", 8],
            ["noscript", "noscript", 5],
        ],
    );
    assert.deepEqual(
        phases.map((phase) => phase.hosts[0].name),
        ["webapp", "static", "static"],
    );
    for (const hosts of [
        [],
        [{ name: "webapp" }],
        [{ name: "webapp" }, { name: "webapp" }],
        [{ name: "webapp" }, { name: "other" }],
    ])
        assert.throws(() => markdownBrowserPhases(hosts, 56, 14));
    assert.throws(() => markdownBrowserPhases([{ name: "webapp" }, { name: "static" }], 0, 14));
});
test("rejects ambiguous, malformed and error-bearing CLI output", () => {
    const output = `### Result\n${JSON.stringify(report(phase.expectedResults))}\n`;
    assert.deepEqual(parseMarkdownBrowserPhase(output, phase).results, phase.expectedResults);
    for (const malformed of ["", "### Result\n{invalid}\n", output + output, `### Error\nfailed\n${output}`])
        assert.throws(() => parseMarkdownBrowserPhase(malformed, phase));
});
