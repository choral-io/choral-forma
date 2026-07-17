import type { DashboardEntrySummary, WorkspaceExplorerResult } from "@choral-forma/shared";
import { describe, expect, it } from "vitest";

import {
    treeNodeCommandId,
    treeNodeIconName,
    viewIconName,
    workspaceTreeChildren,
    workspaceTreeRoots,
} from "./workspace-tree-model.ts";

const explorer: WorkspaceExplorerResult = {
    schemaVersion: 1,
    operation: "workspace.explorer",
    status: "passed",
    summary: { errors: 0, warnings: 0, infos: 0 },
    diagnostics: [],
    workspace: { root: ".", name: "Workspace" },
    taxonomies: [
        {
            id: "topics",
            title: "Topics",
            mode: "multiple",
            terms: [
                {
                    id: "guides",
                    title: "Guides",
                    entryCount: 1,
                    status: "passed",
                },
            ],
        },
    ],
    views: [
        {
            id: "board",
            path: ".forma/views/board.md",
            kind: "kanban",
            title: "Board",
        },
    ],
};

const entries: DashboardEntrySummary[] = [
    {
        id: "docs--guide",
        path: "docs/guide.md",
        routePath: "/pages/docs/guide",
        rawPath: "/raw/docs/guide.md",
        title: "Guide",
        status: "passed",
        renderable: true,
    },
];

describe("Forma workspace tree model", () => {
    it("builds taxonomy and Views roots from dashboard configuration", () => {
        expect(workspaceTreeRoots(explorer).map((node) => node.type)).toEqual(["taxonomy", "views"]);
    });

    it("nests configured terms and entries under their taxonomy", () => {
        const taxonomy = workspaceTreeRoots(explorer)[0];
        expect(taxonomy).toBeDefined();
        if (!taxonomy) return;
        const term = workspaceTreeChildren(explorer, taxonomy)[0];
        expect(term).toMatchObject({ type: "term", taxonomyId: "topics", value: { id: "guides" } });
        if (!term) return;
        expect(workspaceTreeChildren(explorer, term, entries)).toMatchObject([
            { type: "entry", value: { path: "docs/guide.md" } },
        ]);
    });

    it("omits the Views group when no Views are configured", () => {
        expect(workspaceTreeRoots({ ...explorer, views: [] }).map((node) => node.type)).toEqual(["taxonomy"]);
    });

    it("maps supported View modes to the selected Lucide assets", () => {
        expect(["list", "table", "kanban", "graph", "custom"].map(viewIconName)).toEqual([
            "list",
            "table-properties",
            "kanban",
            "network",
            "eye",
        ]);
    });

    it("uses one Lucide icon family across every tree level", () => {
        const [taxonomy, views] = workspaceTreeRoots(explorer);
        if (!taxonomy || !views) return;
        const term = workspaceTreeChildren(explorer, taxonomy)[0];
        const view = workspaceTreeChildren(explorer, views)[0];
        if (term?.type !== "term" || !view) return;
        const entry = workspaceTreeChildren(explorer, term, entries)[0];
        if (!entry) return;

        expect([
            treeNodeIconName(taxonomy),
            treeNodeIconName(term),
            treeNodeIconName(entry),
            treeNodeIconName(views),
            treeNodeIconName(view),
            treeNodeIconName({ type: "loadMore", taxonomyId: "topics", termId: "guides", cursor: "100" }),
        ]).toEqual(["tags", "folder", "file-text", "panels-top-left", "kanban", "ellipsis"]);
        expect(treeNodeIconName({ ...term, value: { ...term.value, status: "failed" } })).toBe("triangle-alert");
    });

    it("opens View nodes in Preview while entries keep opening source", () => {
        const [taxonomy, views] = workspaceTreeRoots(explorer);
        expect(taxonomy).toBeDefined();
        expect(views).toBeDefined();
        if (!taxonomy || !views) return;
        const term = workspaceTreeChildren(explorer, taxonomy)[0];
        const view = workspaceTreeChildren(explorer, views)[0];
        expect(term).toBeDefined();
        expect(view).toBeDefined();
        if (!term || !view) return;
        const entry = workspaceTreeChildren(explorer, term, entries)[0];
        expect(entry).toBeDefined();
        if (!entry) return;

        expect(treeNodeCommandId(view)).toBe("forma.openViewPreview");
        expect(treeNodeCommandId(entry)).toBe("vscode.open");
    });

    it("adds a load-more node when another entry page is available", () => {
        const taxonomy = workspaceTreeRoots(explorer)[0];
        if (!taxonomy) return;
        const term = workspaceTreeChildren(explorer, taxonomy)[0];
        if (!term) return;
        expect(workspaceTreeChildren(explorer, term, entries, "100").at(-1)).toMatchObject({
            type: "loadMore",
            cursor: "100",
        });
    });
});
