// @vitest-environment jsdom
import { format, getFileInfo, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import cases from "../../../../../fixtures/forma-validation/cases/markdown-formatting.json";
import caseSource from "../../../../../fixtures/forma-validation/cases/markdown-formatting.json?raw";
import { postProcessMarkdownHtml } from "./MarkdownReader";
import { renderMarkdown } from "./markdown-renderer";

const filepath = "fixtures/forma-validation/samples/markdown/reading-p1.md";

describe("Markdown formatting contract", () => {
    it("uses the repository preserve policy without formatter exclusions", async () => {
        for (const path of [filepath, "docs/workspace/markdown.md", "README.md"]) {
            expect((await resolveConfig(path, { editorconfig: true }))?.proseWrap).toBe("preserve");
            expect((await getFileInfo(path, { ignorePath: ".prettierignore" })).ignored).toBe(false);
        }
        expect(cases.length).toBeGreaterThan(0);
        expect(new Set(cases.map((fixture) => fixture.id)).size).toBe(cases.length);
        expect(new Set(cases.map((fixture) => fixture.category))).toEqual(
            new Set(["prose", "definition", "callout", "math", "disclosure", "hardbreak"]),
        );
    });

    it.each(cases)("preserves $id source through two formatting passes", async (fixture) => {
        const options = await resolveConfig(filepath, { editorconfig: true });
        const formatted = await format(fixture.source, { ...options, filepath });
        expect(formatted).toBe(fixture.source);
        expect(await format(formatted, { ...options, filepath })).toBe(formatted);

        // Definition-list boundaries are formatting guarantees; rendering remains literal.
        const render = async (markdown: string) =>
            postProcessMarkdownHtml(await renderMarkdown(markdown), [], "notes/formatting.md", [], false);
        const html = await render(formatted);
        expect(html).toBe(await render(fixture.source));
        const body = new DOMParser().parseFromString(html, "text/html").body;
        for (const [selector, count] of Object.entries(fixture.selectors)) {
            if (typeof count !== "number") throw new TypeError(`Invalid selector count: ${selector}`);
            expect(body.querySelectorAll(selector), selector).toHaveLength(count);
        }
        for (const literal of fixture.text) expect(body.textContent).toContain(literal);
    });

    it("detects paragraph and definition boundaries lost under the previous never policy", async () => {
        const options = await resolveConfig(filepath, { editorconfig: true });
        for (const id of ["authored-paragraph-lines", "definition-simple", "definition-blocks"]) {
            const fixture = cases.find((fixture) => fixture.id === id);
            expect(fixture, id).toBeDefined();
            if (!fixture) throw new Error(`Missing negative-control fixture: ${id}`);
            expect(await format(fixture.source, { ...options, filepath, proseWrap: "never" })).not.toBe(fixture.source);
        }
    });

    it("keeps exact Markdown strings intact when formatting the shared JSON", async () => {
        const filepath = "fixtures/forma-validation/cases/markdown-formatting.json";
        const options = await resolveConfig(filepath, { editorconfig: true });
        const formatted = await format(caseSource, { ...options, filepath });
        expect(formatted).toBe(caseSource);
        expect(JSON.parse(formatted)).toEqual(cases);
        expect(await format(formatted, { ...options, filepath })).toBe(formatted);
        expect((await getFileInfo(filepath, { ignorePath: ".prettierignore" })).ignored).toBe(false);
    });
});
