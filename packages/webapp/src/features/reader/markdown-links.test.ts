import { describe, expect, it } from "vitest";

import { resolveReaderLink } from "./markdown-links";

const entries = [
    {
        path: "guidelines/content-authoring.md",
        routePath: "/guidelines/content-authoring",
    },
    {
        path: "product/atlas-notes.md",
        routePath: "/product/atlas-notes",
    },
];
const currentPath = "guidelines/content-authoring.md";

describe("resolveReaderLink", () => {
    it("keeps same-document anchors on the current Entry route", () => {
        expect(resolveReaderLink("#verification", currentPath, entries)).toEqual({
            href: "/guidelines/content-authoring#verification",
            kind: "anchor",
            opensInNewTab: false,
        });
    });

    it("keeps homepage entry anchors on the displayed homepage route", () => {
        expect(resolveReaderLink("#verification", currentPath, entries, "/")).toEqual({
            href: "/#verification",
            kind: "anchor",
            opensInNewTab: false,
        });
    });

    it("resolves relative workspace links to internal Entry routes", () => {
        expect(resolveReaderLink("../product/atlas-notes.md#scope", currentPath, entries)).toEqual({
            href: "/product/atlas-notes#scope",
            kind: "internal",
            opensInNewTab: false,
        });
    });

    it("resolves workspace source paths even when a different entry has the same public route", () => {
        expect(
            resolveReaderLink("/notes/target.md#details", "notes/links.md", [
                { path: "notes/target.md", routePath: "/notes/target" },
                { path: "notes/target.md.md", routePath: "/notes/target.md" },
            ]),
        ).toEqual({
            href: "/notes/target#details",
            kind: "internal",
            opensInNewTab: false,
        });
    });

    it("resolves an encoded relative Markdown link to its sibling even when the root has the same name", () => {
        expect(
            resolveReaderLink("./target%2Emd?mode=reader#scope", "notes/source.md", [
                { path: "target.md", routePath: "/target" },
                { path: "notes/target.md", routePath: "/notes/target" },
            ]).href,
        ).toBe("/notes/target?mode=reader#scope");
    });

    it("resolves a View's source link to the selected language variant's public route", () => {
        expect(
            resolveReaderLink("/notes/target.zh-hans.md#scope", ".forma/views/catalog.md", [
                {
                    path: "notes/target.md",
                    routePath: "/notes/target",
                    variants: [{ path: "notes/target.zh-hans.md", routePath: "/notes/target.zh-hans" }],
                },
            ]).href,
        ).toBe("/notes/target.zh-hans#scope");
    });

    it.each([
        ["./target%2Emd", "/notes/target"],
        ["./literal%2520.md", "/notes/literal%2520"],
        ["./hash%23.md?name=a%20b#section", "/notes/hash%23?name=a%20b#section"],
        ["./query%3F.md", "/notes/query%3F"],
        ["?mode=reader#details", "/notes/source?mode=reader#details"],
    ])("resolves the Markdown URI %s once while preserving its suffix", (href, expected) => {
        expect(
            resolveReaderLink(href, "notes/source.md", [
                { path: "notes/source.md", routePath: "/notes/source" },
                { path: "notes/target.md", routePath: "/notes/target" },
                { path: "notes/literal%20.md", routePath: "/notes/literal%2520" },
                { path: "notes/hash#.md", routePath: "/notes/hash%23" },
                { path: "notes/query?.md", routePath: "/notes/query%3F" },
            ]).href,
        ).toBe(expected);
    });

    it("keeps a query-only link on the displayed homepage route", () => {
        expect(resolveReaderLink("?mode=reader#scope", currentPath, entries, "/").href).toBe("/?mode=reader#scope");
    });

    it("marks HTTP links as external links that open in a new tab", () => {
        expect(resolveReaderLink("https://example.com/docs", currentPath, entries)).toEqual({
            href: "https://example.com/docs",
            kind: "external",
            opensInNewTab: true,
        });
    });

    it("preserves non-web protocols without forcing a new tab", () => {
        expect(resolveReaderLink("mailto:team@example.com", currentPath, entries)).toEqual({
            href: "mailto:team@example.com",
            kind: "external",
            opensInNewTab: false,
        });
    });
});
