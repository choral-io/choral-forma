// @vitest-environment jsdom
import { format, getFileInfo, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import cases from "../../../../../fixtures/forma-validation/cases/markdown-reading-p1.json";
import sample from "../../../../../fixtures/forma-validation/samples/markdown/reading-p1.md?raw";
import { postProcessMarkdownHtml } from "./MarkdownReader";
import { renderMarkdown } from "./markdown-renderer";

describe("P1 reading syntax", () => {
    it.each(cases)("renders $id without changing literal or deletion semantics", async (fixture) => {
        const html = postProcessMarkdownHtml(await renderMarkdown(fixture.source), [], "notes/probe.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        for (const [tag, count] of Object.entries({ mark: 0, sub: 0, sup: 0, del: 0, ...fixture.tags })) {
            if (typeof count !== "number") throw new TypeError(`Invalid count for ${tag}`);
            expect(body.querySelectorAll(tag), tag).toHaveLength(count);
        }
        expect(body.querySelectorAll(".katex-display")).toHaveLength(fixture.displayMath);
        expect(body.querySelectorAll(".katex")).toHaveLength(fixture.inlineMath + fixture.displayMath);
        for (const text of fixture.contains) expect(body.textContent).toContain(text);
        expect(body.querySelector("script,iframe,[onerror],[onclick]")).toBeNull();
    });
    it("keeps the combined reading sample in normal formatting", async () => {
        expect(cases.length).toBeGreaterThan(0);
        expect(new Set(cases.map((fixture) => fixture.id)).size).toBe(cases.length);
        const filepath = "fixtures/forma-validation/samples/markdown/reading-p1.md";
        expect((await getFileInfo(filepath, { ignorePath: ".prettierignore" })).ignored).toBe(false);
        const options = await resolveConfig(filepath);
        const formatted = await format(sample, { ...options, filepath });
        expect(formatted).toBe(sample);
        expect(await format(formatted, { ...options, filepath })).toBe(formatted);
        expect(await renderMarkdown(formatted)).toBe(await renderMarkdown(sample));
    });
    it("preserves readable heading targets with highlighted content", async () => {
        const html = postProcessMarkdownHtml(await renderMarkdown("## ==章节=="), [], "reader.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelector("#forma-heading-章节")).not.toBeNull();
        expect(body.querySelector("h2 mark")?.textContent).toBe("章节");
    });
    it("keeps reader extensions literal in image alternatives", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown("![==literal== $2$ **bold**](image-viewer.svg)"),
            [],
            "reader.md",
            [],
            false,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelector("img")?.alt).toBe("==literal== $2$ bold");
        expect(body.querySelector("mark,math,.katex")).toBeNull();
    });
    it("keeps attributes and other raw HTML under the existing sanitizer", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown('<mark onclick="alert(1)">safe text</mark><script>alert(1)</script>'),
            [],
            "reader.md",
            [],
            false,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelector("script,[onclick]")).toBeNull();
        expect(body.textContent).toContain("safe text");
    });
});
