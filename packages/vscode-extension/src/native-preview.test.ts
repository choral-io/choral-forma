import { describe, expect, it } from "vitest";

import {
    clearMarkdownProjections,
    enhanceMarkdownPreview,
    extendMarkdownIt,
    setMarkdownEnhancement,
} from "./markdown-enhancer.ts";

describe("native Markdown preview enhancement", () => {
    it("replaces the content mount for Forma View documents", () => {
        expect(
            enhanceMarkdownPreview("<h1>Board</h1><!-- forma:content --><p>After</p>", {
                projection: "<section>View</section>",
            }),
        ).toBe("<h1>Board</h1><section>View</section><p>After</p>");
    });

    it("appends the projection when the mount is absent", () => {
        expect(enhanceMarkdownPreview("<h1>Board</h1>", { projection: "<section>View</section>" })).toBe(
            "<h1>Board</h1><section>View</section>",
        );
    });

    it("leaves ordinary Markdown unchanged", () => {
        expect(enhanceMarkdownPreview("<h1>Note</h1>", undefined)).toBe("<h1>Note</h1>");
    });

    it("links resolved scalar and list values in the native frontmatter table", () => {
        const html =
            '<table class="frontmatter"><tbody><tr><th>owners</th><td><ul><li>members/noah-kim</li><li>members/ava-patel</li></ul></td></tr><tr><th>status</th><td>ready</td></tr></tbody></table>';
        expect(
            enhanceMarkdownPreview(html, {
                frontmatterLinks: [
                    { field: "owners", value: "members/noah-kim", targetPath: "members/noah-kim.md" },
                    { field: "owners", value: "members/ava-patel", targetPath: "members/ava-patel.md" },
                ],
            }),
        ).toContain('<a class="forma-frontmatter-link" href="/members/noah-kim.md">members/noah-kim</a>');
    });

    it("renders a resolved wikilink as a native Preview link", () => {
        expect(
            enhanceMarkdownPreview("<p>See [[releases/planning-beta]] next.</p>", {
                bodyLinks: [
                    {
                        raw: "[[releases/planning-beta]]",
                        label: "releases/planning-beta",
                        targetPath: "releases/planning-beta.md",
                    },
                ],
            }),
        ).toBe(
            '<p>See <a class="forma-wikilink" href="/releases/planning-beta.md">releases/planning-beta</a> next.</p>',
        );
    });

    it("uses wikilink aliases and preserves resolved heading fragments", () => {
        expect(
            enhanceMarkdownPreview("<p>Ask [[members/noah-kim|Noah]] about [[docs/guide#Getting Started]].</p>", {
                bodyLinks: [
                    {
                        raw: "[[members/noah-kim|Noah]]",
                        label: "Noah",
                        targetPath: "members/noah-kim.md",
                    },
                    {
                        raw: "[[docs/guide#Getting Started]]",
                        label: "docs/guide#Getting Started",
                        targetPath: "docs/guide.md",
                        fragment: "Getting Started",
                    },
                ],
            }),
        ).toBe(
            '<p>Ask <a class="forma-wikilink" href="/members/noah-kim.md">Noah</a> about <a class="forma-wikilink" href="/docs/guide.md#Getting%20Started">docs/guide#Getting Started</a>.</p>',
        );
    });

    it("leaves unresolved wikilinks and code examples unchanged", () => {
        const html = "<p>Missing [[missing/note]].</p><code>[[docs/guide]]</code><pre>[[docs/guide]]</pre>";
        expect(
            enhanceMarkdownPreview(html, {
                bodyLinks: [
                    {
                        raw: "[[docs/guide]]",
                        label: "Guide",
                        targetPath: "docs/guide.md",
                    },
                ],
            }),
        ).toBe(html);
    });

    it("leaves native Markdown links unchanged", () => {
        const html = '<p><a href="/docs/guide.md">Guide</a> <a href="https://forma.choral.io">Forma</a></p>';
        expect(
            enhanceMarkdownPreview(html, {
                bodyLinks: [
                    {
                        raw: "[[docs/guide]]",
                        label: "Guide",
                        targetPath: "docs/guide.md",
                    },
                ],
            }),
        ).toBe(html);
    });

    it("matches cached projections by document path when URI serialization differs", () => {
        setMarkdownEnhancement("file:///workspace/.forma/views/board.md", { projection: "<section>View</section>" });
        const markdownIt = extendMarkdownIt({
            renderer: { render: () => "<h1>Board</h1><!-- forma:content -->" },
        });

        expect(
            markdownIt.renderer.render(
                [],
                {},
                {
                    currentDocument: {
                        path: "/workspace/.forma/views/board.md",
                        toString: () => "vscode-remote://ssh/workspace/.forma/views/board.md",
                    },
                },
            ),
        ).toBe("<h1>Board</h1><section>View</section>");
        clearMarkdownProjections();
    });
});
