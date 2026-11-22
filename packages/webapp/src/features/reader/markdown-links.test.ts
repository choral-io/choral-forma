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

    it("resolves bare relative author links beside the source before the workspace root", () => {
        const guides = [
            { path: "guide.md", routePath: "/guide.md" },
            { path: "notes/guide.md", routePath: "/notes/guide.md" },
        ];
        expect(resolveReaderLink("guide?keep=1&keep=2#scope", "notes/source.md", guides).href).toBe(
            "/notes/guide.md?keep=1&keep=2#scope",
        );
        expect(resolveReaderLink("/guide.md#scope", "notes/source.md", guides).href).toBe("/guide.md#scope");
    });

    it("resolves a unique managed multi-segment author suffix and preserves query and fragment", () => {
        const href = "guides/target.md?x=1&tag=a&tag=b#section";
        const target = { path: "notes/guides/target.md", routePath: "/notes/guides/target.md" };
        expect(resolveReaderLink(href, "notes/sub/source.md", [target]).href).toBe(
            "/notes/guides/target.md?x=1&tag=a&tag=b#section",
        );
    });

    it("preserves a normalized short path for explicitly relative author links", () => {
        const href = "../guides/target.md?x=1#section";
        const path = "archive/notes/guides/target.md";
        expect(resolveReaderLink(href, "notes/sub/source.md", [{ path, routePath: `/${path}` }]).href).toBe(
            "/archive/notes/guides/target.md?x=1#section",
        );
    });

    it("prefers nearer exact paths and workspace paths before trying a short path", () => {
        const targetPaths = [
            "notes/sub/guides/near.md",
            "guides/near.md",
            "notes/guides/near.md",
            "notes/guides/workspace.md",
            "guides/workspace.md",
        ];
        const entries = targetPaths.map((path) => ({ path, routePath: `/${path}` }));
        const resolve = (href: string) => resolveReaderLink(href, "notes/sub/source.md", entries).href;

        expect(resolve("guides/near?x=1#section")).toBe("/notes/sub/guides/near.md?x=1#section");
        expect(resolve("guides/workspace.md?x=1#section")).toBe("/guides/workspace.md?x=1#section");
        expect(resolve("/guides/near.md?x=1#section")).toBe("/guides/near.md?x=1#section");
    });

    it("does not choose among ambiguous or unqualified suffix candidates", () => {
        const targetPaths = [
            "notes/guides/target.md",
            "archive/guides/target.md",
            "archive/notes/sub/guides/target.md",
            "archive/deep/guides/unqualified.md",
            "archive/guides/other.mdx",
            "target.md",
        ];
        const entries = targetPaths.map((path) => ({ path, routePath: `/${path}` }));
        const resolve = (href: string) => resolveReaderLink(href, "notes/sub/source.md", entries).href;

        expect(resolve("guides/target.md?x=1#section")).toBe("guides/target.md?x=1#section");
        expect(resolve("guides/unqualified.md?x=1#section")).toBe("guides/unqualified.md?x=1#section");
        expect(resolve("guides/other.md?x=1#section")).toBe("guides/other.md?x=1#section");
        expect(resolve("/guides/other.mdx?x=1#section")).toBe("/guides/other.mdx?x=1#section");
        expect(resolve("../../../target.md?x=1#section")).toBe("../../../target.md?x=1#section");
    });

    it("distinguishes exact files, explicit directory links, and URI-encoded literal percent escapes", () => {
        const documents = [
            { path: "notes/guide.md", routePath: "/notes/guide.md" },
            { path: "notes/guide/index.mdx", routePath: "/notes/guide/index.mdx" },
            { path: "notes/literal/slash.md", routePath: "/notes/literal/slash.md" },
            { path: "notes/literal%2Fslash.md", routePath: "/notes/literal%252Fslash.md" },
        ];
        const directories = [{ path: "notes/guide", routePath: "/notes/guide" }];
        const resolve = (href: string) =>
            resolveReaderLink(href, "notes/source.md", documents, "/notes/source.md", "workspace", directories).href;
        expect(resolve("./guide")).toBe("/notes/guide.md");
        expect(resolve("./guide/?keep=1&keep=2#title")).toBe("/notes/guide?keep=1&keep=2#title");
        expect(resolve("./guide/index.mdx#title")).toBe("/notes/guide/index.mdx#title");
        expect(resolve("./literal%2Fslash.md")).toBe("./literal%2Fslash.md");
        expect(resolve("./literal%252Fslash.md")).toBe("/notes/literal%252Fslash.md");
    });

    it("keeps a resource-like indexed directory without an intro on its directory route", () => {
        const path = "notes/magazine.txt";
        const dirs = [{ path, routePath: `/${path}` }];
        expect(
            resolveReaderLink("./magazine.txt?x=1#section", "notes/source.md", [], undefined, "workspace", dirs).href,
        ).toBe("/notes/magazine.txt?x=1#section");
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

    it("keeps a query-only link on the displayed View route", () => {
        expect(
            resolveReaderLink("?mode=reader#scope", ".forma/views/catalog.md", entries, "/-/views/catalog").href,
        ).toBe("/-/views/catalog?mode=reader#scope");
    });

    it.each([
        ["./target", "/notes/target"],
        ["./folder", "/notes/folder"],
        ["/notes/folder", "/notes/folder"],
        ["./folder/index.md", "/notes/folder/index.md"],
        ["./literal%2520", "/notes/literal%2520"],
    ])("resolves the Entry or directory destination for %s", (href, expected) => {
        const suffix = "?value=a%2Fb&tag=one&tag=two#target";
        expect(
            resolveReaderLink(
                href + suffix,
                "notes/source.md",
                [
                    { path: "notes/target.md", routePath: "/notes/target" },
                    { path: "notes/folder/index.md", routePath: "/notes/folder/index.md" },
                    { path: "notes/literal%20.md", routePath: "/notes/literal%2520" },
                ],
                undefined,
                "workspace",
                [{ path: "notes/folder", routePath: "/notes/folder" }],
            ).href,
        ).toBe(expected + suffix);
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
