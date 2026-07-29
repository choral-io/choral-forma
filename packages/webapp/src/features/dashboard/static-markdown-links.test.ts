// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { clearStaticRuntimeConfig, setStaticRuntimeConfig } from "@/data/static-runtime.test-support";
import type { DashboardEntry } from "@/data/workspace-client";

import { postProcessMarkdownHtml } from "./MarkdownReader";
import { resolveReaderLinkNavigation } from "./reader-link-navigation";

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

    it("normalizes internal reader navigation and detects same-page fragments", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });
        const anchor = document.createElement("a");
        anchor.href = "/preview/pages/notes/two?mode=reader#scope";

        expect(resolveReaderLinkNavigation(anchor, "https://example.test/preview/pages/notes/one")).toEqual({
            href: "/pages/notes/two?mode=reader#scope",
            samePageFragment: false,
        });

        anchor.href = "/preview/pages/notes/one#details";
        expect(resolveReaderLinkNavigation(anchor, "https://example.test/preview/pages/notes/one")).toEqual({
            href: "/pages/notes/one#details",
            samePageFragment: true,
        });
    });

    it("leaves external, modified-target, and download links to the browser", () => {
        for (const configure of [
            (anchor: HTMLAnchorElement) => {
                anchor.href = "https://external.test";
                anchor.dataset.linkKind = "external";
            },
            (anchor: HTMLAnchorElement) => {
                anchor.href = "/pages/notes/two";
                anchor.target = "_blank";
            },
            (anchor: HTMLAnchorElement) => {
                anchor.href = "/pages/notes/two";
                anchor.download = "two.md";
            },
            (anchor: HTMLAnchorElement) => {
                anchor.href = "/pages/notes/two";
                anchor.rel = "noopener external";
            },
        ]) {
            const anchor = document.createElement("a");
            configure(anchor);
            expect(resolveReaderLinkNavigation(anchor, "https://example.test/pages/notes/one")).toBeUndefined();
        }
    });
});
