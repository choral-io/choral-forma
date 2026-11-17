import { describe, expect, it } from "vitest";

import type { DashboardEntry, WorkspaceDashboard } from "@/data/workspace-client";

import { projectedDirectoryListing } from "./directory-listing";

function entry(path: string, title: string): DashboardEntry {
    return {
        id: path,
        path,
        routePath: `/${path}`,
        title,
        summary: "",
        updatedLabel: "",
        space: "notes",
        omitLeadingTitle: false,
        status: "healthy",
        body: [],
        variants: [],
        relations: { outgoing: [], backlinks: [] },
    };
}

const listing = {
    path: "notes",
    routePath: "/notes",
    introEntryPath: "notes/index.md",
    childDirectoryPaths: ["notes/Gespräch"],
    entryPaths: ["notes/index.mdx", "notes/index.md", "notes/index.zh.md", "notes/item-10.md", "notes/item-2.md"],
};
const child = {
    path: "notes/Gespräch",
    routePath: "/notes/Gespr%C3%A4ch",
    childDirectoryPaths: ["notes/Gespräch/deep"],
    entryPaths: [],
};
const entries = [
    {
        ...entry("notes/index.md", "Intro"),
        variants: [
            {
                path: "notes/index.zh.md",
                rawPath: "notes/index.zh.md",
                routePath: "/notes/index.zh.md",
                language: "zh",
                title: "简介",
            },
        ],
    },
    entry("notes/index.mdx", "MDX intro"),
    entry("notes/item-10.md", "Item 10"),
    entry("notes/item-2.md", "Item 2"),
    entry("notes/Gespräch/deep/more.md", "More"),
    entry("notes.md", "Separate note"),
];
const dashboard = {
    entries,
    directories: [
        listing,
        child,
        {
            path: "notes/Gespräch/deep",
            routePath: "/notes/Gespr%C3%A4ch/deep",
            childDirectoryPaths: [],
            entryPaths: ["notes/Gespräch/deep/more.md"],
        },
    ],
} as WorkspaceDashboard;

describe("projectedDirectoryListing", () => {
    it("lists direct projected paths, preserving both exact introductions and variants", () => {
        const result = projectedDirectoryListing(dashboard, listing);
        expect(result.entries.map(({ routePath }) => routePath)).toEqual([
            "/notes/index.md",
            "/notes/item-2.md",
            "/notes/item-10.md",
            "/notes/index.mdx",
            "/notes/index.zh.md",
        ]);
        expect(result.directories).toEqual([
            { documentCount: 1, name: "Gespräch", path: child.path, routePath: child.routePath, title: undefined },
        ]);
    });

    it("lists a child folder even when the parent has no direct file", () => {
        expect(projectedDirectoryListing(dashboard, child)).toMatchObject({
            entries: [],
            directories: [{ name: "deep", documentCount: 1, routePath: "/notes/Gespr%C3%A4ch/deep" }],
        });
    });
});
