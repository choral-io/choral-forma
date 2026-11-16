import { describe, expect, it } from "vitest";

import { directoryOwners } from "@/features/navigation/directory-owners";

import { directoryBreadcrumb, entryDirectoryBreadcrumb } from "./entry-breadcrumb";

const page = (path: string, routePath = `/${path.replace(/\.md$/u, "")}`) => ({ path, routePath });

describe("entryDirectoryBreadcrumb", () => {
    it("leads through each containing directory to its page; the workspace crumb is home", () => {
        expect(entryDirectoryBreadcrumb(page("knowledge/design/reader.md"))).toEqual([
            { label: "knowledge", to: "/knowledge" },
            { label: "design", to: "/knowledge/design" },
        ]);
    });

    it("has no directory crumbs for a root-level entry", () => {
        expect(entryDirectoryBreadcrumb(page("README.md"))).toEqual([]);
        expect(entryDirectoryBreadcrumb(page("/notes.md"))).toEqual([]);
    });

    it("labels a directory with the title of the document that stands for it, and never links a page to itself", () => {
        const entries = [
            { path: "team/index.md", routePath: "/team", title: "Our Team" },
            { path: "team/alex.md", routePath: "/team/alex", title: "Alex" },
        ];
        const owners = directoryOwners(entries);

        expect(entryDirectoryBreadcrumb(page("team/alex.md"), owners)).toEqual([{ label: "Our Team", to: "/team" }]);
        expect(entryDirectoryBreadcrumb(page("team/index.md", "/team"), owners)).toEqual([]);
    });

    it("leaves a directory's own name out of its page's breadcrumb", () => {
        expect(directoryBreadcrumb("a b/c", false)).toEqual([{ label: "a b", to: "/a%20b" }]);
    });
});
