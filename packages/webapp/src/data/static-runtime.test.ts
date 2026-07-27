import { afterEach, describe, expect, it } from "vitest";

import { isStaticRawHref, logicalHref, logicalPathname, rootAwareHref, staticRouterBasename } from "./static-runtime";

describe("static runtime URL helpers", () => {
    afterEach(() => {
        globalThis.__FORMA_STATIC_WORKSPACE__ = undefined;
    });

    it("uses the generated root path as the router basename", () => {
        globalThis.__FORMA_STATIC_WORKSPACE__ = {
            dataBaseUrl: "/preview/data",
            homeEntryId: "notes--one",
            rootPath: "/preview",
        };

        expect(staticRouterBasename()).toBe("/preview");
        expect(rootAwareHref("/pages/notes/one#scope")).toBe("/preview/pages/notes/one#scope");
        expect(rootAwareHref("/preview/raw/notes/image.png")).toBe("/preview/raw/notes/image.png");
        expect(logicalHref("/preview/pages/notes/one#scope")).toBe("/pages/notes/one#scope");
        expect(logicalHref("/previewer/pages/notes/one")).toBe("/previewer/pages/notes/one");
        expect(logicalPathname("/preview/views/notes/")).toBe("/views/notes");
        expect(isStaticRawHref("/preview/raw/notes/image.png")).toBe(true);
    });

    it("does not rewrite external, protocol, fragment, or rootless targets", () => {
        globalThis.__FORMA_STATIC_WORKSPACE__ = {
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        };

        expect(rootAwareHref("https://example.com/docs")).toBe("https://example.com/docs");
        expect(rootAwareHref("mailto:team@example.com")).toBe("mailto:team@example.com");
        expect(rootAwareHref("#scope")).toBe("#scope");
        expect(rootAwareHref("notes/file.md")).toBe("notes/file.md");
    });

    it("keeps RPC builds rooted at the origin", () => {
        expect(staticRouterBasename()).toBe("/");
        expect(rootAwareHref("/pages/notes/one")).toBe("/pages/notes/one");
        expect(logicalPathname("/")).toBe("/");
    });
});
