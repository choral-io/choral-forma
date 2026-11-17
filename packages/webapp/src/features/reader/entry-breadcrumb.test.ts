import { describe, expect, it } from "vitest";

import type { DashboardDirectory } from "@/data/workspace-client";
import { directoryOwners } from "@/features/navigation/directory-owners";

import { directoryBreadcrumb, entryDirectoryBreadcrumb } from "./entry-breadcrumb";

const directories: DashboardDirectory[] = [
    { path: "knowledge", routePath: "/knowledge", childDirectoryPaths: ["knowledge/design"], entryPaths: [] },
    {
        path: "knowledge/design",
        routePath: "/knowledge/design",
        childDirectoryPaths: [],
        entryPaths: ["knowledge/design/reader.md"],
    },
    {
        path: "team",
        routePath: "/team",
        childDirectoryPaths: [],
        entryPaths: ["team/index.md"],
        introEntryPath: "team/index.md",
    },
    { path: "a b", routePath: "/a%20b", childDirectoryPaths: ["a b/c"], entryPaths: [] },
];

describe("entryDirectoryBreadcrumb", () => {
    it("leads through each projected directory to its page", () => {
        expect(entryDirectoryBreadcrumb({ path: "knowledge/design/reader.md" }, directories, new Map())).toEqual([
            { label: "knowledge", to: "/knowledge" },
            { label: "design", to: "/knowledge/design" },
        ]);
    });

    it("has no directory crumbs for a root-level entry", () => {
        expect(entryDirectoryBreadcrumb({ path: "README.md" }, directories, new Map())).toEqual([]);
    });

    it("labels the directory from its selected intro even on the intro's own exact file page", () => {
        const intro = { path: "team/index.md", routePath: "/team/index.md", title: "Our Team" };
        expect(entryDirectoryBreadcrumb(intro, directories, directoryOwners([intro], directories))).toEqual([
            { label: "Our Team", to: "/team" },
        ]);
    });

    it("leaves a directory's own name out of its page's breadcrumb", () => {
        expect(directoryBreadcrumb("a b/c", false, directories, new Map())).toEqual([{ label: "a b", to: "/a%20b" }]);
    });
});
