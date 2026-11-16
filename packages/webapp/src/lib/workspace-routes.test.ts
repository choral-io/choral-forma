import { describe, expect, it } from "vitest";

import {
    directoryForRoutePath,
    directoryPathFromRoutePath,
    directoryRoutePath,
    isSystemRoutePath,
    taxonomyRoutePath,
    taxonomyTermRoutePath,
    viewRoutePath,
} from "./workspace-routes";

describe("workspace route paths", () => {
    it("routes a View by the encoded last segment of its id, as Core does", () => {
        expect(viewRoutePath("planning/release scope")).toBe("/-/views/release%20scope");
        expect(viewRoutePath("wow!'()*")).toBe("/-/views/wow%21%27%28%29%2A");
        // A local server's full path id and a static artifact's public id name one route.
        expect(viewRoutePath(".forma/views/wow!")).toBe("/-/views/wow%21");
        expect(viewRoutePath("wow!")).toBe("/-/views/wow%21");
    });

    it("places taxonomies and terms below browse, encoding each identifier", () => {
        expect(taxonomyRoutePath("work areas")).toBe("/-/browse/work%20areas");
        expect(taxonomyTermRoutePath("work areas", "release/readiness")).toBe(
            "/-/browse/work%20areas/release%2Freadiness",
        );
        // A taxonomy may share a name with a system page; it sits one segment deeper.
        expect(taxonomyRoutePath("browse")).toBe("/-/browse/browse");
        expect(taxonomyTermRoutePath("topic!", "a!'()*")).toBe("/-/browse/topic%21/a%21%27%28%29%2A");
    });

    it("places directories at their workspace paths with Core's segment encoding", () => {
        expect(directoryRoutePath("")).toBe("/");
        expect(directoryRoutePath("/notes/drafts/")).toBe("/notes/drafts");
        expect(directoryRoutePath("a b/(old)!")).toBe("/a%20b/%28old%29%21");
        expect(directoryRoutePath("笔记")).toBe("/%E7%AC%94%E8%AE%B0");
    });

    it("tells system routes from content routes by the reserved segment alone", () => {
        expect(isSystemRoutePath("/-")).toBe(true);
        expect(isSystemRoutePath("/-/views")).toBe(true);
        expect(isSystemRoutePath("/-notes")).toBe(false);
        expect(isSystemRoutePath("/views")).toBe(false);
        expect(isSystemRoutePath("/")).toBe(false);
    });

    it("reads a directory path back from a content route", () => {
        expect(directoryPathFromRoutePath("/")).toBe("");
        expect(directoryPathFromRoutePath("/a%20b/%28old%29")).toBe("a b/(old)");
        expect(directoryPathFromRoutePath("/pages/notes")).toBe("pages/notes");
        expect(directoryPathFromRoutePath("/-/views/board")).toBeUndefined();
        expect(directoryPathFromRoutePath("/%E0%A4%A")).toBeUndefined();
    });

    it("recognizes a content route as a directory only when it holds a document", () => {
        const entries = [{ path: "notes/a.md" }, { path: "notes/deep/b.md" }, { path: "top.md" }];

        expect(directoryForRoutePath(entries, "/notes")).toBe("notes");
        expect(directoryForRoutePath(entries, "/notes/deep")).toBe("notes/deep");
        expect(directoryForRoutePath(entries, "/notes/a")).toBeUndefined();
        expect(directoryForRoutePath(entries, "/top")).toBeUndefined();
        expect(directoryForRoutePath(entries, "/")).toBeUndefined();
        expect(directoryForRoutePath(entries, "/-/views")).toBeUndefined();
    });
});
