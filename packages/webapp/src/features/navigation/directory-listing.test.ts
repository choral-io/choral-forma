import { describe, expect, it } from "vitest";

import { directoryListing } from "./directory-listing";

const entry = (path: string, title: string) => ({ path, routePath: `/pages/${path.replace(/\.md$/u, "")}`, title });
const entries = [
    entry("notes/zeta.md", "Zeta"),
    entry("notes/item-10.md", "Item 10"),
    entry("notes/item-2.md", "Item 2"),
    entry("notes/drafts/idea.md", "Idea"),
    entry("notes/drafts/deep/more.md", "More"),
    entry("Guides/setup.md", "Setup"),
    entry("home.md", "Home"),
];

describe("directoryListing", () => {
    it("lists the folders and documents directly inside a directory", () => {
        expect(directoryListing(entries, "notes")).toEqual({
            directories: [{ documentCount: 2, name: "drafts", path: "notes/drafts" }],
            entries: [
                entry("notes/item-2.md", "Item 2"),
                entry("notes/item-10.md", "Item 10"),
                entry("notes/zeta.md", "Zeta"),
            ],
            path: "notes",
        });
    });

    it("treats the empty path as the workspace root", () => {
        const root = directoryListing(entries, "");
        expect(root?.directories.map((folder) => folder.name)).toEqual(["Guides", "notes"]);
        expect(root?.entries.map((item) => item.path)).toEqual(["home.md"]);
    });

    it("lists a folder that holds only folders, and ignores slashes around the path", () => {
        expect(directoryListing(entries, "/notes/drafts/")?.directories).toEqual([
            { documentCount: 1, name: "deep", path: "notes/drafts/deep" },
        ]);
    });

    it("titles a folder with the document that stands for it and does not list that document", () => {
        const listing = directoryListing(
            [
                { path: "team/index.md", routePath: "/pages/team", title: "Our Team" },
                { path: "team/alex.md", routePath: "/pages/team/alex", title: "Alex" },
                entry("guide.md", "Guide overview"),
                entry("guide/setup.md", "Setup"),
                entry("about.md", "About"),
            ],
            "",
        );

        expect(listing?.directories).toEqual([
            { documentCount: 1, name: "guide", path: "guide", title: "Guide overview" },
            { documentCount: 2, name: "team", path: "team", title: "Our Team" },
        ]);
        expect(listing?.entries.map((item) => item.path)).toEqual(["about.md"]);
        expect(
            directoryListing([{ path: "team/index.md", routePath: "/pages/team", title: "Our Team" }], "team"),
        ).toEqual({
            directories: [],
            entries: [],
            path: "team",
        });
    });

    it("does not treat a document or an unknown path as a directory", () => {
        expect(directoryListing(entries, "notes/zeta.md")).toBeUndefined();
        expect(directoryListing(entries, "missing")).toBeUndefined();
        expect(directoryListing(entries, "note")).toBeUndefined();
    });
});
