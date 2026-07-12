import type { WorkspaceDashboardResult } from "@choral-forma/shared";
import { describe, expect, it } from "vitest";

import { treeNodeCommandId, viewIconName, workspaceTreeChildren, workspaceTreeRoots } from "./workspace-tree-model.ts";

const dashboard: WorkspaceDashboardResult = {
    schemaVersion: 1,
    operation: "workspace.dashboard",
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
                    entries: [
                        {
                            id: "docs--guide",
                            path: "docs/guide.md",
                            routePath: "/pages/docs/guide",
                            rawPath: "/raw/docs/guide.md",
                            title: "Guide",
                            status: "passed",
                            renderable: true,
                        },
                    ],
                },
            ],
        },
    ],
    spaces: [],
    entries: [],
    views: [
        {
            id: "board",
            path: ".forma/views/board.md",
            kind: "kanban",
            title: "Board",
        },
    ],
};

describe("Forma workspace tree model", () => {
    it("builds taxonomy and Views roots from dashboard configuration", () => {
        expect(workspaceTreeRoots(dashboard).map((node) => node.type)).toEqual(["taxonomy", "views"]);
    });

    it("nests configured terms and entries under their taxonomy", () => {
        const taxonomy = workspaceTreeRoots(dashboard)[0];
        expect(taxonomy).toBeDefined();
        if (!taxonomy) return;
        const term = workspaceTreeChildren(dashboard, taxonomy)[0];
        expect(term).toMatchObject({ type: "term", taxonomyId: "topics", value: { id: "guides" } });
        if (!term) return;
        expect(workspaceTreeChildren(dashboard, term)).toMatchObject([
            { type: "entry", value: { path: "docs/guide.md" } },
        ]);
    });

    it("omits the Views group when no Views are configured", () => {
        expect(workspaceTreeRoots({ ...dashboard, views: [] }).map((node) => node.type)).toEqual(["taxonomy"]);
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

    it("opens View nodes in Preview while entries keep opening source", () => {
        const [taxonomy, views] = workspaceTreeRoots(dashboard);
        expect(taxonomy).toBeDefined();
        expect(views).toBeDefined();
        if (!taxonomy || !views) return;
        const term = workspaceTreeChildren(dashboard, taxonomy)[0];
        const view = workspaceTreeChildren(dashboard, views)[0];
        expect(term).toBeDefined();
        expect(view).toBeDefined();
        if (!term || !view) return;
        const entry = workspaceTreeChildren(dashboard, term)[0];
        expect(entry).toBeDefined();
        if (!entry) return;

        expect(treeNodeCommandId(view)).toBe("forma.openViewPreview");
        expect(treeNodeCommandId(entry)).toBe("vscode.open");
    });
});
