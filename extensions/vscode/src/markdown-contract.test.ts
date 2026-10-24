import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extendMarkdownIt } from "./markdown-enhancer.ts";

describe("native Markdown rendering boundary", () => {
    for (const name of [
        "reader",
        "edge-cases",
        "review-regressions",
        "callouts",
        "callout-review",
        "callout-compatibility",
        "callout-interaction",
        "callout-layout",
        "images",
        "viewers",
    ]) {
        it(`leaves host rendering unchanged for ${name}`, () => {
            const source = readFileSync(
                new URL(`../../../fixtures/forma-validation/samples/markdown/${name}.md`, import.meta.url),
                "utf8",
            );
            const host = new MarkdownIt({ html: true });
            const enhanced = new MarkdownIt({ html: true });
            const headingRule = enhanced.renderer.rules.heading_open;
            const rules = enhanced.inline.ruler.getRules("");
            extendMarkdownIt(enhanced);
            expect(enhanced.render(source)).toBe(host.render(source));
            expect(enhanced.renderer.rules.heading_open).toBe(headingRule);
            expect(enhanced.inline.ruler.getRules("")).toEqual(rules);
        });
    }
    it("preserves host-owned rendering rules and can be registered twice", () => {
        const parser = new MarkdownIt();
        parser.renderer.rules.heading_open = () => '<h2 id="host-heading">';
        const source = "## Heading\n\nBody[^note]\n\n[^note]: Note";
        const expected = parser.render(source);
        extendMarkdownIt(parser);
        extendMarkdownIt(parser);
        expect(parser.render(source)).toBe(expected);
    });
});
