import { afterEach, describe, expect, it, vi } from "vitest";

import { StaticWorkspaceClient, type StaticDashboardData } from "./static-workspace-client";

const dashboard: StaticDashboardData = {
    schemaVersion: 1,
    generatorVersion: "test",
    status: "passed",
    workspace: { name: "Static fixture", canonicalLanguage: "en", supportedLanguages: ["en"] },
    spaces: [
        {
            id: "notes",
            title: "Notes",
            entryIds: ["notes--one"],
        },
    ],
    taxonomies: [],
    entries: [
        {
            id: "notes--one",
            path: "notes/one.md",
            routePath: "/pages/notes/one",
            space: "notes",
            title: "One",
            omitLeadingTitle: false,
            status: "passed",
            variants: [],
            dataPath: "data/entries/notes--one.json",
        },
    ],
    views: [
        {
            id: "notes",
            routePath: "/views/notes",
            mode: "list",
            title: "Notes",
            status: "passed",
            dataPath: "data/views/notes.json",
        },
    ],
    summary: { errors: 0, warnings: 0, infos: 0 },
    diagnostics: [],
};

describe("StaticWorkspaceClient", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("uses generated local data with an explicit artifact base", async () => {
        const fetch = vi.fn(async (path: string) => {
            if (path === "/preview/data/dashboard.json") return json(dashboard);
            if (path === "/preview/data/entries/notes--one.json") {
                return json({
                    ...dashboard.entries[0],
                    markdown: "# One",
                    html: "<h1>One</h1>",
                    headings: [],
                    outgoing: [],
                    backlinks: [],
                });
            }
            if (path === "/preview/data/views/notes.json") {
                return json({
                    ...dashboard.views[0],
                    document: { bodySource: "" },
                    projection: { kind: "list", items: [] },
                });
            }
            return new Response(null, { status: 404 });
        });
        vi.stubGlobal("fetch", fetch);
        const client = new StaticWorkspaceClient("/preview/data");

        await expect(client.getDashboard()).resolves.toMatchObject({ workspaceName: "Static fixture" });
        await expect(client.getEntry("notes--one")).resolves.toMatchObject({ title: "One" });
        await expect(client.getViewRender("notes")).resolves.toMatchObject({ projection: { kind: "list" } });
        expect(fetch).toHaveBeenCalledWith("/preview/data/dashboard.json");
        expect(fetch).toHaveBeenCalledWith("/preview/data/entries/notes--one.json");
        expect(fetch).toHaveBeenCalledWith("/preview/data/views/notes.json");
    });

    it("reports missing artifact data without an RPC fallback", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (path: string) =>
                path === "/data/dashboard.json" ? json(dashboard) : new Response(null, { status: 404 }),
            ),
        );
        const client = new StaticWorkspaceClient("/data");
        await expect(client.getEntry("notes--one")).rejects.toThrow(
            "Static artifact data missing: /data/entries/notes--one.json (HTTP 404)",
        );
        await expect(client.getViewRender("notes")).rejects.toThrow(
            "Static artifact data missing: /data/views/notes.json (HTTP 404)",
        );
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 404 })),
        );
        const missingDashboardClient = new StaticWorkspaceClient("/data");
        await expect(missingDashboardClient.getDashboard()).rejects.toThrow(
            "Static artifact data missing: /data/dashboard.json (HTTP 404)",
        );
    });
});

function json(value: unknown): Response {
    return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}
