import { describe, expect, it } from "vitest";

import { directoryOwners } from "@/features/navigation/directory-owners";

import { directoryBreadcrumb, entryDirectoryBreadcrumb } from "./entry-breadcrumb";

const page = (path: string, routePath = `/pages/${path.replace(/\.md$/u, "")}`) => ({ path, routePath });

describe("entryDirectoryBreadcrumb", () => {
    it("leads from Files through each containing directory to its page", () => {
        expect(entryDirectoryBreadcrumb(page("knowledge/design/reader.md"))).toEqual([
            { label: "Files", to: "/pages" },
            { label: "knowledge", to: "/pages/knowledge" },
            { label: "design", to: "/pages/knowledge/design" },
        ]);
    });

    it("leads only to Files for a root-level entry", () => {
        expect(entryDirectoryBreadcrumb(page("README.md"))).toEqual([{ label: "Files", to: "/pages" }]);
        expect(entryDirectoryBreadcrumb(page("/notes.md"))).toEqual([{ label: "Files", to: "/pages" }]);
    });

    it("labels a directory with the title of the document that stands for it, and never links a page to itself", () => {
        const entries = [
            { path: "team/index.md", routePath: "/pages/team", title: "Our Team" },
            { path: "team/alex.md", routePath: "/pages/team/alex", title: "Alex" },
        ];
        const owners = directoryOwners(entries);

        expect(entryDirectoryBreadcrumb(page("team/alex.md"), owners)).toEqual([
            { label: "Files", to: "/pages" },
            { label: "Our Team", to: "/pages/team" },
        ]);
        expect(entryDirectoryBreadcrumb(page("team/index.md", "/pages/team"), owners)).toEqual([
            { label: "Files", to: "/pages" },
        ]);
    });

    it("leaves a directory's own name out of its page's breadcrumb", () => {
        expect(directoryBreadcrumb("a b/c", false)).toEqual([
            { label: "Files", to: "/pages" },
            { label: "a b", to: "/pages/a%20b" },
        ]);
    });
});
