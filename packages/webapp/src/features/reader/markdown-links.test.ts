import { describe, expect, it } from "vitest";

import { resolveReaderLink } from "./markdown-links";

const entries = [
    {
        path: "guidelines/content-authoring.md",
        routePath: "/pages/guidelines/content-authoring",
    },
    {
        path: "product/atlas-notes.md",
        routePath: "/pages/product/atlas-notes",
    },
];
const currentPath = "guidelines/content-authoring.md";

describe("resolveReaderLink", () => {
    it("keeps same-document anchors on the current Entry route", () => {
        expect(resolveReaderLink("#verification", currentPath, entries)).toEqual({
            href: "/pages/guidelines/content-authoring#verification",
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
            href: "/pages/product/atlas-notes#scope",
            kind: "internal",
            opensInNewTab: false,
        });
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
