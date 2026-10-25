// @vitest-environment jsdom
import { format, getFileInfo, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import cases from "../../../../../fixtures/forma-validation/cases/markdown-disclosures.json";
import sample from "../../../../../fixtures/forma-validation/samples/markdown/disclosures.md?raw";
import { postProcessMarkdownHtml } from "./MarkdownReader";
import { prepareDisclosures } from "./markdown-disclosures";
import { renderMarkdown } from "./markdown-renderer";

describe("portable native disclosures", () => {
    it.each(cases)("renders $id safely", async (fixture) => {
        // Sanitization must not be what hides an incorrectly activated disclosure.
        expect(prepareDisclosures(fixture.source).replacements).toHaveLength(fixture.titles.length * 2);
        const html = postProcessMarkdownHtml(await renderMarkdown(fixture.source), [], "notes/folds.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        const folds = [...body.querySelectorAll<HTMLDetailsElement>("details[data-markdown-disclosure]")];
        expect(folds.map((fold) => fold.querySelector(":scope > summary")?.textContent)).toEqual(fixture.titles);
        expect(folds.map((fold) => fold.open)).toEqual(fixture.opens);
        expect(body.querySelectorAll("details:not([data-markdown-disclosure]):not([data-callout-fold])")).toHaveLength(
            0,
        );
        for (const [selector, count] of Object.entries(fixture.selectors)) {
            if (typeof count !== "number") throw new Error("Invalid count");
            expect(body.querySelectorAll(selector), selector).toHaveLength(count);
        }
        for (const literal of fixture.literals) expect(body.textContent).toContain(literal);
        expect(body.querySelector("script,[onclick],[onerror]")).toBeNull();
    });
    it("matches the HTML parser across malformed attribute boundaries", () => {
        const fold = (title: string) => `<details>\n<summary>${title}</summary>\n\nbody\n\n</details>`;
        const parser = new DOMParser();
        for (const name of ["a", 'a"b', "a'b", "a=b", 'a="x"b'])
            for (const separator of ["=", " = ", '="'])
                for (const value of ['"</div></div>"', "'</div></div>'", 'u"v', "x/"]) {
                    const source = `<div ${name}${separator}${value}>\n\n${fold("Inner")}\n\n</div>\n\n${fold("Outside")}`;
                    const document = parser.parseFromString(source, "text/html");
                    const expected = [...document.querySelectorAll("details")]
                        .filter((fold) => !fold.closest("div"))
                        .map((fold) => fold.querySelector(":scope > summary")?.textContent);
                    const actual = prepareDisclosures(source)
                        .replacements.filter(([, html]) => html.startsWith("<details "))
                        .map(
                            ([, html]) =>
                                parser.parseFromString(html, "text/html").querySelector("summary")?.textContent,
                        );
                    expect(actual, source).toEqual(expected);
                }
    });
    it("keeps the reading sample stable through formatting without exclusions", async () => {
        const filepath = "fixtures/forma-validation/samples/markdown/disclosures.md";
        const options = await resolveConfig(filepath, { editorconfig: true });
        expect((await getFileInfo(filepath, { ignorePath: ".prettierignore" })).ignored).toBe(false);
        const formatted = await format(sample, { ...options, filepath });
        expect(formatted).toBe(sample);
        expect(await format(formatted, { ...options, filepath })).toBe(formatted);
        const html = await renderMarkdown(formatted);
        expect(html).toBe(await renderMarkdown(sample));
        expect(html.match(/data-markdown-disclosure=""/g)).toHaveLength(3);
    });
    it.each(["div", "template"])("recovers after deeply nested %s wrappers close", (name) => {
        const fold = "<details>\n<summary>Inner</summary>\n\nbody\n\n</details>\n";
        const source =
            `<${name}>\n`.repeat(2048) +
            "\n" +
            fold +
            "\n" +
            `</${name}>\n`.repeat(2048) +
            "\n" +
            fold.replace("Inner", "Outside");
        const { replacements } = prepareDisclosures(source);
        expect(replacements).toHaveLength(2);
        expect(replacements[0]?.[1]).toContain(">Outside</summary>");
    });
    it("rejects very deep native trees before rendering", () => {
        const source =
            "<details>\n<summary>Layer</summary>\n\n".repeat(2048) + "body\n\n" + "</details>\n\n".repeat(2048);
        expect(prepareDisclosures(source).replacements).toHaveLength(0);
    });
    it("does not infer an unbounded disclosure tree", async () => {
        const source = "<details>\n<summary>Layer</summary>\n\n".repeat(17) + "body\n\n" + "</details>\n\n".repeat(17);
        expect(await renderMarkdown(source)).not.toContain("data-markdown-disclosure");
    });
});
