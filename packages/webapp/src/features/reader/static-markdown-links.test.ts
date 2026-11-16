// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearStaticRuntimeConfig, setStaticRuntimeConfig } from "@/data/static-runtime.test-support";
import type { DashboardEntry } from "@/data/workspace-client";

import { MarkdownReader, postProcessMarkdownHtml } from "./MarkdownReader";
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

        anchor.href = "/preview/notes/one?mode=reader#details";
        expect(resolveReaderLinkNavigation(anchor, "https://example.test/preview/notes/one/?mode=source")).toEqual({
            href: "/notes/one/?mode=reader#details",
            samePageFragment: false,
        });
    });

    it.each([
        { rootPath: "/", linkSource: "workspace" },
        { rootPath: "/preview", linkSource: "published" },
    ] as const)(
        "restores folded footnotes after inheriting or changing the query under $rootPath",
        async ({ rootPath, linkSource }) => {
            const route = "/notes/article";
            const prefix = rootPath === "/" ? "" : rootPath;
            const path = `${prefix}${route}`;
            const currentQuery = "?filter=a%2Fb&tag=one&tag=two";
            const updatedQuery = "?filter=c%3Fd";
            const targetId = "user-content-fnref-body";
            const previousLocation = window.location.href;
            const previousHistoryState: unknown = window.history.state;

            vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
            setStaticRuntimeConfig({ baseUrl: window.location.origin, dataBaseUrl: `${prefix}/-/data`, rootPath });
            window.history.replaceState(null, "", `${path}${prefix ? "/" : ""}${currentQuery}`);
            const container = document.createElement("main");
            Object.defineProperties(container, { scrollHeight: { value: 1000 }, clientHeight: { value: 400 } });
            container.scrollTo = vi.fn();
            document.body.append(container);
            const root = createRoot(container);
            try {
                await act(async () => {
                    root.render(
                        createElement(
                            BrowserRouter,
                            { basename: rootPath },
                            createElement(MarkdownReader, {
                                currentPath: "notes/article.md",
                                currentRoutePath: route,
                                entries: [{ path: "notes/article.md", routePath: route }] as DashboardEntry[],
                                headings: [],
                                linkSource,
                                markdown: [
                                    `[Change query](${updatedQuery})`,
                                    `[Jump with original query](${currentQuery}#${targetId})`,
                                    `[Jump with updated query](${updatedQuery}#${targetId})`,
                                    "> [!note]- Context\n>\n> Target[^body].",
                                    "[^body]: The note.",
                                ].join("\n\n"),
                            }),
                        ),
                    );
                    await Promise.resolve();
                });
                const backref = container.querySelector<HTMLAnchorElement>("a[data-footnote-backref]");
                const fold = container.querySelector<HTMLDetailsElement>("details");
                const reference = container.querySelector<HTMLAnchorElement>(`#${targetId}`);
                const queryLink = container.querySelector<HTMLAnchorElement>('a[data-link-kind="internal"]');
                if (!backref || !fold || !reference || !queryLink)
                    throw new Error("Expected a folded footnote and query link");

                for (const query of [currentQuery, updatedQuery]) {
                    expect(backref.getAttribute("href")).toBe(`${path}${query}#${targetId}`);
                    expect(queryLink.getAttribute("href")).toBe(`${path}${updatedQuery}`);
                    expect(fold.open).toBe(false);
                    backref.focus();
                    act(() => {
                        backref.click();
                    });
                    expect(window.location.search).toBe(query);
                    expect(window.location.hash).toBe(`#${targetId}`);
                    expect(fold.open).toBe(true);
                    expect(document.activeElement).toBe(reference);

                    fold.open = false;
                    act(() => {
                        queryLink.click();
                    });
                }

                for (const query of [currentQuery, updatedQuery]) {
                    const destination = `${path}${query}#${targetId}`;
                    const jump = Array.from(
                        container.querySelectorAll<HTMLAnchorElement>('a[data-link-kind="internal"]'),
                    ).find((link) => link.getAttribute("href") === destination);
                    if (!jump) throw new Error(`Expected an explicit link to ${destination}`);
                    expect(fold.open).toBe(false);
                    act(() => {
                        jump.click();
                    });
                    expect(window.location.search).toBe(query);
                    expect(window.location.hash).toBe(`#${targetId}`);
                    expect(fold.open).toBe(true);
                    expect(document.activeElement).toBe(reference);
                    fold.open = false;
                }
            } finally {
                act(() => {
                    root.unmount();
                });
                container.remove();
                window.history.replaceState(previousHistoryState, "", previousLocation);
                vi.unstubAllGlobals();
            }
        },
    );

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
