// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import type { DashboardEntry } from "@/data/workspace-client";

import { postProcessMarkdownHtml } from "./MarkdownReader";

describe("static Markdown root paths", () => {
    afterEach(() => {
        globalThis.__FORMA_STATIC_WORKSPACE__ = undefined;
    });

    it("keeps generated routes and raw resources under the configured root", () => {
        globalThis.__FORMA_STATIC_WORKSPACE__ = {
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        };
        const entries = [
            {
                path: "notes/two.md",
                routePath: "/pages/notes/two",
            },
        ];
        const html = postProcessMarkdownHtml(
            [
                '<a href="/preview/pages/notes/two#scope">Two</a>',
                '<a href="https://example.com">External</a>',
                '<img alt="Existing" src="/preview/raw/notes/existing.png">',
                '<img alt="Relative" src="./relative.png">',
            ].join(""),
            [],
            "notes/one.md",
            entries as DashboardEntry[],
            false,
        );

        expect(html).toContain('href="/preview/pages/notes/two#scope"');
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('src="/preview/raw/notes/existing.png"');
        expect(html).toContain('src="/preview/raw/notes/relative.png"');
    });
});
