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
                routePath: "/notes/two",
            },
        ];
        const html = postProcessMarkdownHtml(
            [
                '<a href="/preview/notes/two#scope">Two</a>',
                '<a href="https://example.com">External</a>',
                '<img alt="Existing" src="/preview/-/raw/notes/existing.png">',
                '<img alt="Relative" src="./relative.png">',
            ].join(""),
            [],
            "notes/one.md",
            entries as DashboardEntry[],
            false,
            undefined,
            "published",
        );

        expect(html).toContain('href="/preview/notes/two#scope"');
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('src="/preview/-/raw/notes/existing.png"');
        expect(html).toContain('src="/preview/-/raw/notes/relative.png"');
    });

    it.each(["/", "/preview"])("preserves published routes that also name source files under %s", (rootPath) => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: `${rootPath === "/" ? "" : rootPath}/-/data`,
            rootPath,
        });
        const root = rootPath === "/" ? "" : rootPath;
        const entries = [
            { path: "notes/target.md", routePath: "/notes/target" },
            { path: "notes/target.md.md", routePath: "/notes/target.md" },
        ];
        const html = postProcessMarkdownHtml(
            [
                `<a href="${root}/notes/target.md">Published</a>`,
                `<a href="${root}/notes/target.md#details">Fragment</a>`,
                `<a href="${root}/notes/target.md?mode=reader#details">Query</a>`,
                '<a href="./target.md">Source</a>',
                '<a href="./missing.md">Unresolved</a>',
            ].join(""),
            [],
            "notes/links.md",
            entries as DashboardEntry[],
            false,
            undefined,
            "published",
        );
        const document = new DOMParser().parseFromString(html, "text/html");

        expect(Array.from(document.querySelectorAll("a"), (anchor) => anchor.getAttribute("href"))).toEqual([
            `${root}/notes/target.md`,
            `${root}/notes/target.md#details`,
            `${root}/notes/target.md?mode=reader#details`,
            `${root}/notes/target`,
            "./missing.md",
        ]);
    });

    it("resolves static View source Markdown instead of treating it as published routes", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/-/data",
            rootPath: "/preview",
        });
        const entries = [
            { path: "notes/target.md", routePath: "/notes/target" },
            { path: "notes/target.md.md", routePath: "/notes/target.md" },
        ];
        const html = postProcessMarkdownHtml(
            '<a href="/notes/target.md">Root source</a><a href="../../notes/target%2Emd">Encoded source</a>',
            [],
            ".forma/views/notes.md",
            entries as DashboardEntry[],
            false,
        );
        const parsed = new DOMParser().parseFromString(html, "text/html");
        expect(Array.from(parsed.querySelectorAll("a"), (link) => link.getAttribute("href"))).toEqual([
            "/preview/notes/target",
            "/preview/notes/target",
        ]);
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
                routePath: "/notes/home",
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
        expect(html).not.toContain("/notes/home#details");
    });

    it("resolves entry-style links from the workspace root document", () => {
        const entries = [
            {
                path: "notes/two.md",
                routePath: "/notes/two",
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

        expect(html).toContain('href="/notes/two"');
        expect(html).toContain('data-link-kind="internal"');
    });

    it("normalizes internal reader navigation and detects same-page fragments", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });
        const anchor = document.createElement("a");
        anchor.href = "/preview/notes/two?mode=reader#scope";

        expect(resolveReaderLinkNavigation(anchor, "https://example.test/preview/notes/one")).toEqual({
            href: "/notes/two?mode=reader#scope",
            samePageFragment: false,
        });

        anchor.href = "/preview/notes/one#details";
        expect(resolveReaderLinkNavigation(anchor, "https://example.test/preview/notes/one")).toEqual({
            href: "/notes/one#details",
            samePageFragment: true,
        });
    });

    it("leaves raw resource links to browser navigation", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });
        const anchor = document.createElement("a");
        anchor.href = "/preview/-/raw/content/guides/source.txt?download=1#section";

        expect(
            resolveReaderLinkNavigation(anchor, "https://example.test/preview/content/guides/intro"),
        ).toBeUndefined();
    });

    it("leaves external, modified-target, and download links to the browser", () => {
        for (const configure of [
            (anchor: HTMLAnchorElement) => {
                anchor.href = "https://external.test";
                anchor.dataset.linkKind = "external";
            },
            (anchor: HTMLAnchorElement) => {
                anchor.href = "/notes/two";
                anchor.target = "_blank";
            },
            (anchor: HTMLAnchorElement) => {
                anchor.href = "/notes/two";
                anchor.download = "two.md";
            },
            (anchor: HTMLAnchorElement) => {
                anchor.href = "/notes/two";
                anchor.rel = "noopener external";
            },
        ]) {
            const anchor = document.createElement("a");
            configure(anchor);
            expect(resolveReaderLinkNavigation(anchor, "https://example.test/notes/one")).toBeUndefined();
        }
    });
    it("keeps static directory URLs on the same page for fragment navigation", () => {
        const anchor = document.createElement("a");
        anchor.href = "/reader#note";
        expect(resolveReaderLinkNavigation(anchor, `${window.location.origin}/reader/`)?.samePageFragment).toBe(true);
    });
});
