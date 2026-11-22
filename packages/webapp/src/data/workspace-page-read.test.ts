import { describe, expect, it, vi } from "vitest";

import type { DashboardEntry, WorkspaceClient, WorkspaceDashboard } from "./workspace-client";
import { readWorkspacePage, readWorkspacePageGroup } from "./workspace-page-read";

const first = {
    id: "shared-legacy-id",
    path: "guide.md",
    routePath: "/guide.md",
    title: "Individual file",
    variants: [],
} as unknown as DashboardEntry;
const intro = {
    ...first,
    path: "guide/index.md",
    routePath: "/guide/index.md",
    variants: [
        {
            language: "zh-Hans",
            path: "guide/index.zh-hans.md",
            rawPath: "guide/index.zh-hans.md",
            routePath: "/guide/index.zh-hans.md",
        },
    ],
};
const directory = {
    path: "guide",
    routePath: "/guide",
    introduction: { sourcePath: "guide/.index.md", title: "Guide", markdownBefore: "Introduction" },
    childDirectoryPaths: [],
    entryPaths: [intro.path, intro.variants[0]?.path],
};
const view = {
    configId: ".forma/views/alternate/guide",
    routePath: "/-/views/guide--abacabadabac",
};
const dashboard = {
    entries: [first, intro],
    directories: [directory],
    views: [view],
    routeGeneration: "server:1",
} as unknown as WorkspaceDashboard;

function clientFixture() {
    return {
        getDashboard: vi.fn<WorkspaceClient["getDashboard"]>().mockResolvedValue(dashboard),
        getEntry: vi.fn<WorkspaceClient["getEntry"]>().mockResolvedValue(intro),
        getViewRender: vi.fn<WorkspaceClient["getViewRender"]>(),
    } satisfies WorkspaceClient;
}

function generationMismatch() {
    return Object.assign(new Error("Workspace routes changed"), { code: "route.generationMismatch" });
}

describe("readWorkspacePage", () => {
    it("uses the exact route target even when its legacy ID collides with another source", async () => {
        const client = clientFixture();
        await readWorkspacePage(client, dashboard, "/guide/index.md");
        expect(client.getEntry).toHaveBeenCalledExactlyOnceWith(intro.path, expect.anything());
    });

    it("uses the dashboard directory projection and fetches an exact index variant separately", async () => {
        const client = clientFixture();
        await expect(readWorkspacePage(client, dashboard, "/guide")).resolves.toEqual({});
        expect(client.getEntry).not.toHaveBeenCalled();
        await readWorkspacePage(client, dashboard, "/guide/index.zh-hans.md");
        expect(client.getEntry).toHaveBeenCalledExactlyOnceWith("guide/index.zh-hans.md", expect.anything());
    });

    it("uses the projected View route to select the full configuration ID", async () => {
        const client = clientFixture();
        await readWorkspacePage(client, dashboard, view.routePath);
        expect(client.getViewRender).toHaveBeenCalledExactlyOnceWith(view.configId, expect.anything());
        expect(client.getEntry).not.toHaveBeenCalled();
    });
});

describe("readWorkspacePageGroup", () => {
    it("discards the dashboard from a mismatched detail and retries the entire active group once", async () => {
        const client = clientFixture();
        const nextDashboard = { ...dashboard, routeGeneration: "server:2" };
        client.getDashboard.mockResolvedValueOnce(dashboard).mockResolvedValueOnce(nextDashboard);
        client.getEntry.mockRejectedValueOnce(generationMismatch()).mockResolvedValueOnce(first);

        const result = await readWorkspacePageGroup(client, "/guide.md", () => true);

        expect(result).toEqual({ dashboard: nextDashboard, detail: { entry: first } });
        expect(client.getDashboard).toHaveBeenCalledTimes(2);
        expect(client.getEntry.mock.calls.map(([, { dashboard }]) => dashboard.routeGeneration)).toEqual([
            "server:1",
            "server:2",
        ]);
    });

    it("drops an excluded variant from the recovered route", async () => {
        const pathname = "/guide/index.zh-hans.md";
        const client = clientFixture();
        const nextDashboard = {
            ...dashboard,
            routeGeneration: "server:2",
            entries: [first],
            directories: [{ ...directory, introduction: undefined, entryPaths: [] }],
        };
        client.getDashboard.mockResolvedValueOnce(dashboard).mockResolvedValueOnce(nextDashboard);
        client.getEntry.mockRejectedValueOnce(generationMismatch());

        await expect(readWorkspacePageGroup(client, pathname, () => true)).resolves.toEqual({
            dashboard: nextDashboard,
            detail: {},
        });
        expect(client.getDashboard).toHaveBeenCalledTimes(2);
        expect(client.getEntry).toHaveBeenCalledTimes(1);
    });

    it("stops after a second mismatch and drops a superseded attempt", async () => {
        const client = clientFixture();
        client.getEntry.mockRejectedValue(generationMismatch());
        await expect(readWorkspacePageGroup(client, "/guide.md", () => true)).rejects.toMatchObject({
            code: "route.generationMismatch",
        });
        expect(client.getDashboard).toHaveBeenCalledTimes(2);

        client.getDashboard.mockClear();
        client.getEntry.mockClear();
        let current = true;
        client.getEntry.mockImplementationOnce(() => {
            current = false;
            throw generationMismatch();
        });
        await expect(readWorkspacePageGroup(client, "/guide.md", () => current)).resolves.toBeUndefined();
        expect(client.getDashboard).toHaveBeenCalledOnce();
    });
});
