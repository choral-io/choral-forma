import { describe, expect, it } from "vitest";

import {
    directoryForRoutePath,
    directoryPathFromRoutePath,
    directoryRoutePath,
    legacyWorkspaceRouteRedirect,
    taxonomyRoutePath,
    taxonomyTermRoutePath,
    viewRoutePath,
} from "./workspace-routes";

describe("workspace route paths", () => {
    it("keeps configured view path segments while encoding each segment", () => {
        expect(viewRoutePath("planning/release scope")).toBe("/views/planning/release%20scope");
    });

    it("encodes configured taxonomy and term identifiers", () => {
        expect(taxonomyRoutePath("work areas")).toBe("/work%20areas");
        expect(taxonomyTermRoutePath("work areas", "release/readiness")).toBe("/work%20areas/release%2Freadiness");
    });

    it("places directories in the page namespace with Core's segment encoding", () => {
        expect(directoryRoutePath("")).toBe("/pages");
        expect(directoryRoutePath("/notes/drafts/")).toBe("/pages/notes/drafts");
        expect(directoryRoutePath("a b/(old)!")).toBe("/pages/a%20b/%28old%29%21");
        expect(directoryRoutePath("笔记")).toBe("/pages/%E7%AC%94%E8%AE%B0");
    });

    it("reads a directory path back from a page route", () => {
        expect(directoryPathFromRoutePath("/pages")).toBe("");
        expect(directoryPathFromRoutePath("/pages/a%20b/%28old%29")).toBe("a b/(old)");
        expect(directoryPathFromRoutePath("/views/board")).toBeUndefined();
        expect(directoryPathFromRoutePath("/pagesx")).toBeUndefined();
        expect(directoryPathFromRoutePath("/pages/%E0%A4%A")).toBeUndefined();
    });

    it("recognizes a page route as a directory only when it holds a document", () => {
        const entries = [{ path: "notes/a.md" }, { path: "notes/deep/b.md" }, { path: "top.md" }];

        expect(directoryForRoutePath(entries, "/pages/notes")).toBe("notes");
        expect(directoryForRoutePath(entries, "/pages/notes/deep")).toBe("notes/deep");
        expect(directoryForRoutePath(entries, "/pages/notes/a")).toBeUndefined();
        expect(directoryForRoutePath(entries, "/pages/top")).toBeUndefined();
        expect(directoryForRoutePath(entries, "/pages")).toBeUndefined();
        expect(directoryForRoutePath(entries, "/views/notes")).toBeUndefined();
    });

    it("redirects the legacy taxonomies route to browse", () => {
        expect(legacyWorkspaceRouteRedirect("/taxonomies")).toBe("/browse");
        expect(legacyWorkspaceRouteRedirect("/taxonomies/")).toBe("/browse");
        expect(legacyWorkspaceRouteRedirect("/browse")).toBeUndefined();
    });
});
