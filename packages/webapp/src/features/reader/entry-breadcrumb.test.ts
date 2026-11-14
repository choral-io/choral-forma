import { describe, expect, it } from "vitest";

import type { DashboardTaxonomy } from "@/data/workspace-client";

import { entryCollectionBreadcrumb, entryDirectoryBreadcrumb } from "./entry-breadcrumb";

describe("entryDirectoryBreadcrumb", () => {
    it("lists containing directories without the file itself", () => {
        expect(entryDirectoryBreadcrumb("knowledge/design/reader.md")).toEqual([
            { label: "knowledge" },
            { label: "design" },
        ]);
    });

    it("is empty for a root-level entry", () => {
        expect(entryDirectoryBreadcrumb(".forma.md")).toEqual([]);
        expect(entryDirectoryBreadcrumb("/notes.md")).toEqual([]);
    });
});

describe("entryCollectionBreadcrumb", () => {
    const taxonomies = [
        { id: "areas", title: "Areas", terms: [{ id: "design", title: "Design", entries: [{ path: "a.md" }] }] },
        {
            id: "tags",
            title: "Tags",
            terms: [
                { id: "draft", title: "Draft", entries: [{ path: "b.md" }] },
                { id: "shared", title: "Shared", entries: [{ path: "a.md" }, { path: "b.md" }] },
            ],
        },
    ] as unknown as DashboardTaxonomy[];

    it("links the first taxonomy and term that contain the entry", () => {
        expect(entryCollectionBreadcrumb(taxonomies, "a.md")).toEqual([
            { label: "Areas", to: "/areas" },
            { label: "Design", to: "/areas/design" },
        ]);
        expect(entryCollectionBreadcrumb(taxonomies, "b.md")).toEqual([
            { label: "Tags", to: "/tags" },
            { label: "Draft", to: "/tags/draft" },
        ]);
    });

    it("is empty for an entry outside every term", () => {
        expect(entryCollectionBreadcrumb(taxonomies, "c.md")).toEqual([]);
    });
});
