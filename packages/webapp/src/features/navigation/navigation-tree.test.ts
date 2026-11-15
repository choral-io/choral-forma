import { describe, expect, it } from "vitest";

import { buildCollectionTree, buildViewTree, collectionIdsContaining } from "./collection-tree";
import { buildFileTree } from "./file-tree";
import {
    describeDuplicateSiblings,
    filesDefaultOpenIds,
    navigationAncestorIds,
    navigationRevealIds,
    navigationSiblings,
    workspaceDefaultOpenIds,
    type NavigationNode,
} from "./navigation-tree";

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

    it("compacts a chain of single-directory levels into one row whose segments keep their own pages", () => {
        const tree = buildFileTree([entry("knowledge/workspace/member/note.md", "Member"), entry("top.md", "Top")]);

        expect(outline(tree)).toEqual(["directory:knowledge/workspace/member", "  entry:Member", "entry:Top"]);
        expect(tree[0]).toMatchObject({
            id: "directory:knowledge/workspace/member",
            to: "/pages/knowledge/workspace/member",
            segments: [
                { label: "knowledge", path: "knowledge", to: "/pages/knowledge" },
                { label: "workspace", path: "knowledge/workspace", to: "/pages/knowledge/workspace" },
                { label: "member", path: "knowledge/workspace/member", to: "/pages/knowledge/workspace/member" },
            ],
        });
        expect(tree[1]?.segments).toBeUndefined();
    });

    it("lets the document served at a directory's route title that directory", () => {
        const tree = buildFileTree([
            { path: "guide/index.md", routePath: "/pages/guide", title: "Guide" },
            entry("guide/README.md", "Read me"),
            entry("notes.md", "Notes overview"),
            entry("notes/a.md", "A"),
            entry("other.md", "Other"),
        ]);

        expect(outline(tree)).toEqual([
            "directory:Guide",
            "  entry:Read me",
            "directory:Notes overview",
            "  entry:A",
            "entry:Other",
        ]);
        expect(tree.map((node) => [node.to, node.title, node.documentPath])).toEqual([
            ["/pages/guide", "guide", "guide/index.md"],
            ["/pages/notes", "notes", "notes.md"],
            ["/pages/other", "other.md", "other.md"],
        ]);
    });

    it("never compacts a titled directory into a chain", () => {
        const tree = buildFileTree([
            { path: "members/tiscs/index.md", routePath: "/pages/members/tiscs", title: "Tiscs" },
            entry("a.md", "A overview"),
            entry("a/b/c.md", "C"),
        ]);

        expect(outline(tree)).toEqual([
            "directory:A overview",
            "  directory:b",
            "    entry:C",
            "directory:members",
            "  directory:Tiscs",
        ]);
        // A directory whose document is all it holds is a plain link with no disclosure.
        expect(tree[1]?.children?.[0]).toEqual({
            id: "directory:members/tiscs",
            kind: "directory",
            label: "Tiscs",
            name: "tiscs/",
            title: "members/tiscs",
            to: "/pages/members/tiscs",
            documentPath: "members/tiscs/index.md",
        });
    });

    it("leads with the workspace entry document and leaves it out of adjacent order", () => {
        const tree = buildFileTree([
            entry("zeta.md", "Zeta"),
            entry("notes/a.md", "A"),
            { path: ".forma.md", routePath: "/", title: "Workspace" },
            entry("alpha.md", "Alpha"),
        ]);

        expect(outline(tree)).toEqual(["home:Workspace", "directory:notes", "  entry:A", "entry:Alpha", "entry:Zeta"]);
        expect(tree[0]).toEqual({ id: "home", kind: "home", label: "Workspace", title: ".forma.md", to: "/" });
        expect(navigationSiblings(tree, "/pages/alpha")).toMatchObject({
            previous: undefined,
            next: { label: "Zeta" },
        });
    });

    it("describes siblings that share a label by their file or directory names", () => {
        const tree = buildFileTree([
            entry("notes/overview.md", "Overview"),
            entry("notes/intro.md", "overview"),
            entry("notes/unique.md", "Unique"),
            { path: "notes/guides/index.md", routePath: "/pages/notes/guides", title: "Overview" },
            entry("notes/guides/setup.md", "Setup"),
            entry("other/overview.md", "Overview"),
        ]);
        const notes = tree.find((node) => node.title === "notes");

        expect(notes?.children?.map((node) => [node.label, node.description])).toEqual([
            ["Overview", "guides/"],
            ["overview", "intro.md"],
            ["Overview", "overview.md"],
            ["Unique", undefined],
        ]);
        // Position already tells apart the same title in another directory.
        expect(tree.find((node) => node.title === "other")?.children?.[0]?.description).toBeUndefined();
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

    it("describes terms that share a title by their ids", () => {
        const tree = describeDuplicateSiblings(
            buildCollectionTree([
                {
                    id: "areas",
                    title: "Areas",
                    description: "",
                    terms: [
                        { id: "design", title: "Design", description: "", entries: [] },
                        { id: "design-ops", title: "Design", description: "", entries: [] },
                        { id: "build", title: "Build", description: "", entries: [] },
                    ],
                },
            ] as unknown as Parameters<typeof buildCollectionTree>[0]),
        );

        expect(tree[0]?.description).toBeUndefined();
        expect(tree[0]?.children?.map((node) => node.description)).toEqual(["design", "design-ops", undefined]);
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
                name: ".forma/views/board",
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
        const compacted = buildFileTree([entry("a/b/c/d.md", "D"), entry("top.md", "Top")]);
        expect(navigationAncestorIds(compacted, "/pages/a/b")).toEqual([]);
        expect(navigationAncestorIds(compacted, "/pages/a/b/c/d")).toEqual(["directory:a/b/c"]);
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

describe("default expansion", () => {
    const home = { path: ".forma.md", routePath: "/", title: "Home" };

    it("opens every Workspace root", () => {
        const tree = [
            ...buildCollectionTree(taxonomies),
            ...buildViewTree([{ id: "board", path: "", title: "Board", description: "", kind: "kanban" }] as Parameters<
                typeof buildViewTree
            >[0]),
        ];
        expect(workspaceDefaultOpenIds(tree)).toEqual(["taxonomy:areas", "taxonomy:tags", "views"]);
    });

    it("opens a lone root folder in Files and nothing otherwise", () => {
        expect(
            filesDefaultOpenIds(buildFileTree([home, entry("knowledge/a/x.md", "X"), entry("knowledge/b/y.md", "Y")])),
        ).toEqual(["directory:knowledge"]);
        expect(filesDefaultOpenIds(buildFileTree([home, entry("notes/a.md", "A"), entry("tasks/b.md", "B")]))).toEqual(
            [],
        );
        expect(
            filesDefaultOpenIds(buildFileTree([home, entry("notes/a.md", "A"), entry("readme.md", "Read me")])),
        ).toEqual([]);
    });
});
