import { describe, expect, it } from "vitest";

import { buildCollectionTree, buildViewTree, collectionIdsContaining } from "./collection-tree";
import { buildFileTree } from "./file-tree";
import { navigationAncestorIds, navigationRevealIds, navigationSiblings, type NavigationNode } from "./navigation-tree";

const entry = (path: string, title: string) => ({ path, routePath: `/pages/${path.replace(/\.md$/u, "")}`, title });

function outline(nodes: NavigationNode[], depth = 0): string[] {
    return nodes.flatMap((node) => [
        `${"  ".repeat(depth)}${node.kind}:${node.label}`,
        ...outline(node.children ?? [], depth + 1),
    ]);
}

describe("buildFileTree", () => {
    it("groups by directory, lists directories first, and sorts by displayed text", () => {
        const tree = buildFileTree([
            entry("notes/zeta.md", "Alpha note"),
            entry("readme.md", "Readme"),
            entry("notes/drafts/idea.md", "Idea"),
            entry("notes/item-10.md", "Item 10"),
            entry("notes/item-2.md", "Item 2"),
            entry("Guides/setup.md", "Setup"),
        ]);

        expect(outline(tree)).toEqual([
            "directory:Guides",
            "  entry:Setup",
            "directory:notes",
            "  directory:drafts",
            "    entry:Idea",
            "  entry:Alpha note",
            "  entry:Item 2",
            "  entry:Item 10",
            "entry:Readme",
        ]);
    });

    it("collapses a chain of single-directory levels into one row", () => {
        const tree = buildFileTree([entry("knowledge/workspace/member/note.md", "Member"), entry("top.md", "Top")]);

        expect(outline(tree)).toEqual(["directory:knowledge/workspace/member", "  entry:Member", "entry:Top"]);
        expect(tree[0]?.id).toBe("directory:knowledge/workspace/member");
        expect(tree[0]?.to).toBe("/pages/knowledge/workspace/member");
    });

    it("lets a directory row stand for the document served at its route", () => {
        const tree = buildFileTree([
            { path: "guide/index.md", routePath: "/pages/guide", title: "Guide" },
            entry("guide/README.md", "Read me"),
            entry("notes.md", "Notes overview"),
            entry("notes/a.md", "A"),
            entry("other.md", "Other"),
        ]);

        expect(outline(tree)).toEqual([
            "directory:guide",
            "  entry:Read me",
            "directory:notes",
            "  entry:A",
            "entry:Other",
        ]);
        expect(tree.map((node) => node.to)).toEqual(["/pages/guide", "/pages/notes", "/pages/other"]);
    });

    it("turns a directory that holds only its own document into a plain link", () => {
        const [member] = buildFileTree([
            { path: "members/tiscs/index.md", routePath: "/pages/members/tiscs", title: "Tiscs" },
        ]);

        expect(member).toEqual({
            id: "directory:members/tiscs",
            kind: "directory",
            label: "members/tiscs",
            title: "members/tiscs",
            to: "/pages/members/tiscs",
        });
    });

    it("keeps a same-named document whose directory row is merged into a chain", () => {
        const tree = buildFileTree([entry("a.md", "A overview"), entry("a/b/c.md", "C")]);

        expect(outline(tree)).toEqual(["directory:a/b", "  entry:C", "entry:A overview"]);
    });
});

const taxonomies = [
    {
        id: "areas",
        title: "Areas",
        description: "Where work lives",
        display: { icon: "shapes", color: "#64748B" },
        terms: [
            {
                id: "design",
                title: "Design",
                description: "",
                display: { icon: "lightbulb" },
                entries: [entry("a.md", "A")],
            },
            { id: "build", title: "Build", description: "", entries: [] },
        ],
    },
    {
        id: "tags",
        title: "Tags",
        description: "",
        terms: [{ id: "shared", title: "Shared", description: "", entries: [entry("a.md", "A"), entry("b.md", "B")] }],
    },
] as unknown as Parameters<typeof buildCollectionTree>[0];

describe("buildCollectionTree", () => {
    it("keeps the read model's order and lists terms without their entries", () => {
        expect(outline(buildCollectionTree(taxonomies))).toEqual([
            "taxonomy:Areas",
            "  term:Design",
            "  term:Build",
            "taxonomy:Tags",
            "  term:Shared",
        ]);
    });

    it("routes taxonomies and terms and carries their display hints", () => {
        const [areas] = buildCollectionTree(taxonomies);

        expect(areas).toMatchObject({
            display: { color: "#64748B", icon: "shapes" },
            title: "Where work lives",
            to: "/areas",
        });
        expect(areas?.children?.[0]).toMatchObject({
            display: { icon: "lightbulb" },
            title: undefined,
            to: "/areas/design",
        });
        expect(areas?.children?.[0]?.children).toBeUndefined();
    });

    it("finds every row that classifies a document", () => {
        expect(collectionIdsContaining(taxonomies, "a.md")).toEqual(
            new Set(["taxonomy:areas", "term:areas/design", "taxonomy:tags", "term:tags/shared"]),
        );
        expect(collectionIdsContaining(taxonomies, "b.md")).toEqual(new Set(["taxonomy:tags", "term:tags/shared"]));
        expect(collectionIdsContaining(taxonomies, "c.md")).toEqual(new Set());
    });
});

describe("buildViewTree", () => {
    it("groups the Views under one routed node and keeps each renderer kind", () => {
        const [group] = buildViewTree([
            { id: ".forma/views/board", path: "", title: "Board", description: "Work", kind: "kanban" },
        ] as Parameters<typeof buildViewTree>[0]);

        expect(group).toMatchObject({ id: "views", kind: "views", label: "Views", to: "/views" });
        expect(group?.children).toEqual([
            {
                id: "view:.forma/views/board",
                kind: "view",
                label: "Board",
                title: "Work",
                to: "/views/.forma/views/board",
                viewKind: "kanban",
            },
        ]);
    });

    it("adds nothing when no View is configured", () => {
        expect(buildViewTree([])).toEqual([]);
    });
});

describe("navigation lookups", () => {
    const tree = buildFileTree([
        entry("notes/a.md", "A"),
        entry("notes/b.md", "B"),
        entry("notes/c.md", "C"),
        entry("notes/drafts/idea.md", "Idea"),
    ]);

    it("finds the branches above a route", () => {
        expect(navigationAncestorIds(tree, "/pages/notes/b")).toEqual(["directory:notes"]);
        expect(navigationAncestorIds(tree, "/pages/notes")).toEqual([]);
        expect(navigationAncestorIds(tree, "/pages/missing")).toBeUndefined();
    });

    it("finds adjacent documents among siblings and skips branches", () => {
        expect(navigationSiblings(tree, "/pages/notes/b")).toMatchObject({
            previous: { label: "A" },
            next: { label: "C" },
        });
        expect(navigationSiblings(tree, "/pages/notes/a")).toMatchObject({ previous: undefined, next: { label: "B" } });
        expect(navigationSiblings(tree, "/pages/notes/drafts/idea")).toEqual({ previous: undefined, next: undefined });
        expect(navigationSiblings(tree, "/pages/missing")).toBeUndefined();
    });
});

describe("navigationRevealIds", () => {
    const tree = buildFileTree([entry("notes/drafts/idea.md", "Idea"), entry("notes/a.md", "A")]);

    it("opens the branches above a document", () => {
        expect(navigationRevealIds(tree, "/pages/notes/drafts/idea")).toEqual([
            "directory:notes",
            "directory:notes/drafts",
        ]);
    });

    it("leaves a destination that is itself a branch as it was", () => {
        expect(navigationRevealIds(tree, "/pages/notes")).toEqual([]);
        expect(navigationRevealIds(tree, "/pages/notes/drafts")).toEqual(["directory:notes"]);
    });

    it("opens nothing for a route outside the tree", () => {
        expect(navigationRevealIds(tree, "/health")).toEqual([]);
        expect(navigationAncestorIds(tree, "/health")).toBeUndefined();
    });
});
