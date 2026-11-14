import { describe, expect, it } from "vitest";

import { buildCollectionTree } from "./collection-tree";
import { buildFileTree } from "./file-tree";
import { navigationAncestorIds, navigationSiblings, type NavigationNode } from "./navigation-tree";

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
        const tree = buildFileTree([entry("knowledge/workspace/member/index.md", "Member"), entry("top.md", "Top")]);

        expect(outline(tree)).toEqual(["directory:knowledge/workspace/member", "  entry:Member", "entry:Top"]);
        expect(tree[0]?.id).toBe("directory:knowledge/workspace/member");
    });

    it("keeps directories as groupings and never promotes an index file", () => {
        const [directory] = buildFileTree([entry("guide/index.md", "Guide"), entry("guide/README.md", "Read me")]);

        expect(directory?.to).toBeUndefined();
        expect(directory?.children?.map((node) => [node.label, node.title, node.to])).toEqual([
            ["Guide", "guide/index.md", "/pages/guide/index"],
            ["Read me", "guide/README.md", "/pages/guide/README"],
        ]);
    });
});

describe("buildCollectionTree", () => {
    const term = (id: string, entries: ReturnType<typeof entry>[]) => ({ id, title: id.toUpperCase(), entries });
    const dashboard = {
        taxonomies: [
            { id: "areas", title: "Areas", terms: [term("design", [entry("a.md", "A")]), term("build", [])] },
            { id: "tags", title: "Tags", terms: [term("shared", [entry("a.md", "A"), entry("b.md", "B")])] },
        ],
        views: [{ id: ".forma/views/board", title: "Board", description: "", kind: "kanban" as const }],
    } as unknown as Parameters<typeof buildCollectionTree>[0];

    it("keeps configured order and appends a Views group", () => {
        expect(outline(buildCollectionTree(dashboard))).toEqual([
            "taxonomy:Areas",
            "  term:DESIGN",
            "    entry:A",
            "  term:BUILD",
            "taxonomy:Tags",
            "  term:SHARED",
            "    entry:A",
            "    entry:B",
            "views:Views",
            "  view:Board",
        ]);
    });

    it("routes taxonomies, terms, and views and gives repeated entries distinct ids", () => {
        const tree = buildCollectionTree(dashboard);
        const ids = new Set<string>();
        const visit = (nodes: NavigationNode[]) => {
            for (const node of nodes) {
                expect(ids.has(node.id), node.id).toBe(false);
                ids.add(node.id);
                visit(node.children ?? []);
            }
        };
        visit(tree);

        expect(tree[0]?.to).toBe("/areas");
        expect(tree[0]?.children?.[0]?.to).toBe("/areas/design");
        expect(tree[2]?.children?.[0]).toMatchObject({ to: "/views/.forma/views/board", viewKind: "kanban" });
    });

    it("omits the Views group when no View is configured", () => {
        expect(buildCollectionTree({ ...dashboard, views: [] }).map((node) => node.kind)).toEqual([
            "taxonomy",
            "taxonomy",
        ]);
    });
});

describe("navigation lookups", () => {
    const tree = buildCollectionTree({
        taxonomies: [
            {
                id: "areas",
                title: "Areas",
                terms: [
                    { id: "one", title: "One", entries: [entry("a.md", "A"), entry("b.md", "B"), entry("c.md", "C")] },
                    { id: "two", title: "Two", entries: [entry("b.md", "B")] },
                ],
            },
        ],
        views: [],
    } as unknown as Parameters<typeof buildCollectionTree>[0]);

    it("reveals only the first branch that contains the route", () => {
        expect(navigationAncestorIds(tree, "/pages/b")).toEqual(["taxonomy:areas", "term:areas/one"]);
        expect(navigationAncestorIds(tree, "/areas/two")).toEqual(["taxonomy:areas"]);
        expect(navigationAncestorIds(tree, "/areas")).toEqual([]);
        expect(navigationAncestorIds(tree, "/pages/missing")).toBeUndefined();
    });

    it("finds adjacent documents among siblings and skips branches", () => {
        expect(navigationSiblings(tree, "/pages/b")).toMatchObject({ previous: { label: "A" }, next: { label: "C" } });
        expect(navigationSiblings(tree, "/pages/a")).toMatchObject({ previous: undefined, next: { label: "B" } });
        expect(navigationSiblings(tree, "/areas/one")).toEqual({ previous: undefined, next: undefined });
        expect(navigationSiblings(tree, "/pages/missing")).toBeUndefined();
    });
});
