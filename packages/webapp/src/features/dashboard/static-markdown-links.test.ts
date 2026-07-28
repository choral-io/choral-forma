// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { clearStaticRuntimeConfig, setStaticRuntimeConfig } from "@/data/static-runtime.test-support";
import type { DashboardEntry } from "@/data/workspace-client";

import { postProcessMarkdownHtml } from "./MarkdownReader";

describe("static Markdown root paths", () => {
    afterEach(() => {
        clearStaticRuntimeConfig();
    });

    it("keeps generated routes and raw resources under the configured root", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });
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

    it("keeps a homepage entry fragment on the displayed homepage route", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });
        const entries = [
            {
                path: "notes/home.md",
                routePath: "/pages/notes/home",
            },
        ];

        const html = postProcessMarkdownHtml(
            '<a href="#details">Details</a>',
            [],
            "notes/home.md",
            entries as DashboardEntry[],
            false,
            "/",
        );

        expect(html).toContain('href="/preview/#details"');
        expect(html).not.toContain("/pages/notes/home#details");
    });

    it("resolves entry-style links from the workspace root document", () => {
        const entries = [
            {
                path: "notes/two.md",
                routePath: "/pages/notes/two",
            },
        ];

        const html = postProcessMarkdownHtml(
            '<a href="./notes/two.md">Two</a>',
            [],
            ".forma.md",
            entries as DashboardEntry[],
            false,
            "/",
        );

        expect(html).toContain('href="/pages/notes/two"');
        expect(html).toContain('data-link-kind="internal"');
    });
});
