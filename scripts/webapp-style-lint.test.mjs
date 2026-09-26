import { ESLint } from "eslint";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../packages/webapp/", import.meta.url));
const eslint = new ESLint({ cwd });
// Use a real included file so projectService checks the probe instead of rejecting its path.
// lintText never writes the probe into the source file. Keep the actual repository config loaded.
const filePath = "src/features/dashboard/ViewGraphProjection.tsx";
const prefix = "better-tailwindcss/";

async function lintClasses(source) {
    const results = await eslint.lintText(source, { filePath });
    assert.equal(results.length, 1);
    const { messages } = results[0];
    assert.deepEqual(
        messages.filter((message) => message.fatal || !message.ruleId),
        [],
        "Ignored files and parser/configuration errors must not masquerade as passing coverage",
    );
    // Probes are intentionally small and need not satisfy unrelated React/export/formatting rules.
    return messages.filter((message) => message.ruleId.startsWith(prefix));
}

const carriers = {
    jsx: (classes) => `export const probe = <div className="${classes}" />;`,
    classConstant: (classes) => `export const probeClass = "${classes}";`,
    classNameConstant: (classes) => `export const probeClassName = "${classes}";`,
    composition: (classes) => `import { cn } from "@/lib/utils"; export const probe = cn("${classes}");`,
};

for (const [name, source] of Object.entries(carriers)) {
    test(`${name}: accepts valid classes and detects unknown, conflicting, and duplicate classes`, async () => {
        assert.deepEqual(await lintClasses(source("p-2 text-base-content")), []);
        for (const [classes, rule] of [
            ["forma-nonexistent-utility", "no-unknown-classes"],
            ["p-2 p-4", "no-conflicting-classes"],
            ["p-2 p-2", "no-duplicate-classes"],
        ]) {
            const messages = await lintClasses(source(classes));
            assert.ok(
                messages.some((message) => message.ruleId === prefix + rule),
                `${name}: ${rule}`,
            );
        }
    });
}

for (const method of ["add", "remove", "replace", "toggle"]) {
    test(`classList.${method}: validates individual tokens`, async () => {
        const source = (token) =>
            `export function probe(el: HTMLElement) { el.classList.${method}(${method === "replace" ? '"p-4", ' : ""}"${token}"); }`;
        assert.deepEqual(await lintClasses(source("p-2")), []);
        const messages = await lintClasses(source("forma-nonexistent-utility"));
        assert.ok(messages.some((message) => message.ruleId === prefix + "no-unknown-classes"));
    });
}

test("classList known gaps: separate arguments/calls are not analyzed as one class list", async () => {
    // These assertions document current limits, not desired semantic safety. If an upgrade gains
    // coverage, review its behavior and update this test and the configuration comment together.
    for (const body of [
        'el.classList.add("p-2", "p-4");',
        'el.classList.add("p-2", "p-2");',
        'el.classList.add("p-2"); el.classList.add("p-4");',
    ]) {
        assert.deepEqual(await lintClasses(`export function probe(el: HTMLElement) { ${body} }`), []);
    }
});

test("classList.replace accepts mutually exclusive old and new classes", async () => {
    assert.deepEqual(
        await lintClasses('export function probe(el: HTMLElement) { el.classList.replace("p-2", "p-4"); }'),
        [],
    );
});

test("known gaps: imperative className and generated HTML are not checked", async () => {
    for (const source of [
        'export function probe(el: HTMLElement) { el.className = "forma-nonexistent-utility p-2 p-4"; }',
        "export const html = '<div class=\"forma-nonexistent-utility p-2 p-4\"></div>';",
    ]) {
        assert.deepEqual(await lintClasses(source), []);
    }
});
