import { afterEach, describe, expect, it, vi } from "vitest";

import { StaticWorkspaceClient, type StaticDashboardData } from "./static-workspace-client";

const localizedVariant = {
    id: "notes--one.zh-hans",
    language: "zh-Hans",
    path: "notes/one.zh-Hans.md",
    routePath: "/pages/notes/one.zh-Hans",
    title: "一",
    omitLeadingTitle: false,
    dataPath: "data/entries/notes--one.zh-hans.json",
};

const dashboard: StaticDashboardData = {
    schemaVersion: 1,
    generatorVersion: "test",
    status: "passed",
    workspace: { name: "Static fixture", canonicalLanguage: "en", supportedLanguages: ["en", "zh-Hans"] },
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
            variants: [localizedVariant],
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
        const fetch = vi.fn((path: string) => {
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
            if (path === "/preview/data/entries/notes--one.zh-hans.json") {
                return json({
                    ...localizedVariant,
                    markdown: "# 一",
                    html: '<h1 id="一">一</h1>',
                    headings: [{ id: "段落", level: 2, text: "段落" }],
                });
            }
            if (path === "/preview/data/views/notes.json") {
                return json({
                    ...dashboard.views[0],
                    sourcePath: ".forma/views/notes.md",
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
        await expect(client.getEntry("notes--one.zh-hans")).resolves.toMatchObject({
            id: "notes--one.zh-hans",
            path: "notes/one.zh-Hans.md",
            routePath: "/pages/notes/one.zh-Hans",
            title: "一",
        });
        await expect(client.getViewRender("notes")).resolves.toMatchObject({
            document: { path: ".forma/views/notes.md" },
            projection: { kind: "list" },
        });
        expect(fetch).toHaveBeenCalledWith("/preview/data/dashboard.json");
        expect(fetch).toHaveBeenCalledWith("/preview/data/entries/notes--one.json");
        expect(fetch).toHaveBeenCalledWith("/preview/data/entries/notes--one.zh-hans.json");
        expect(fetch).toHaveBeenCalledWith("/preview/data/views/notes.json");
    });

    it("reports missing artifact data without an RPC fallback", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) =>
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
            vi.fn(() => new Response(null, { status: 404 })),
        );
        const missingDashboardClient = new StaticWorkspaceClient("/data");
        await expect(missingDashboardClient.getDashboard()).rejects.toThrow(
            "Static artifact data missing: /data/dashboard.json (HTTP 404)",
        );
    });

    it("keeps fetch failures as the cause of a static-artifact diagnostic", async () => {
        const cause = new TypeError("offline");
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.reject(cause)),
        );
        const client = new StaticWorkspaceClient("/data");

        await expect(client.getDashboard()).rejects.toMatchObject({
            cause,
            message: "Static artifact data missing: /data/dashboard.json",
        });
    });

    it("falls back to an empty list when View projection data is absent", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) => {
                if (path === "/data/dashboard.json") return json(dashboard);
                if (path === "/data/views/notes.json")
                    return json({ ...dashboard.views[0], document: { bodySource: "" } });
                return new Response(null, { status: 404 });
            }),
        );
        const client = new StaticWorkspaceClient("/data");

        await expect(client.getViewRender("notes")).resolves.toMatchObject({
            projection: { items: [], kind: "list" },
        });
    });

    it("keeps an empty Kanban list field empty instead of rendering JSON brackets", async () => {
        const kanbanView = { ...dashboard.views[0], mode: "kanban" };
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) => {
                if (path === "/data/dashboard.json") return json({ ...dashboard, views: [kanbanView] });
                if (path === "/data/views/notes.json") {
                    return json({
                        ...kanbanView,
                        document: { bodySource: "" },
                        projection: {
                            kind: "kanban",
                            card: {
                                titleField: "fields.title",
                                subtitleFields: ["fields.assignees"],
                                badgeFields: [],
                            },
                            columns: [
                                {
                                    id: "backlog",
                                    label: "Backlog",
                                    items: [
                                        {
                                            path: "notes/one.md",
                                            title: "One",
                                            fields: {
                                                "fields.assignees": { kind: "value", value: [] },
                                                "fields.empty": { kind: "value", value: null },
                                                "fields.labels": { kind: "value", value: ["static", "site"] },
                                                "fields.title": { kind: "value", value: "One" },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    });
                }
                return new Response(null, { status: 404 });
            }),
        );
        const client = new StaticWorkspaceClient("/data");

        const render = await client.getViewRender("notes");
        if (render.projection.kind !== "kanban") throw new Error("expected Kanban projection");
        const firstColumn = render.projection.columns[0];
        const firstItem = firstColumn?.items[0];
        if (!firstItem) throw new Error("expected Kanban card");
        const fields = firstItem.fields;
        expect(fields["fields.assignees"]).toBe("");
        expect(fields["fields.empty"]).toBe("");
        expect(fields["fields.labels"]).toBe("static, site");
    });

    it("uses the entry path when a static entry title is blank", async () => {
        const blankTitleEntry = { ...dashboard.entries[0], title: "   " };
        const blankTitleDashboard = { ...dashboard, entries: [blankTitleEntry] };
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) => {
                if (path === "/data/dashboard.json") return json(blankTitleDashboard);
                if (path === "/data/entries/notes--one.json") {
                    return json({
                        ...blankTitleEntry,
                        markdown: "# One",
                        html: "<h1>One</h1>",
                        headings: [],
                        outgoing: [],
                        backlinks: [],
                    });
                }
                return new Response(null, { status: 404 });
            }),
        );
        const client = new StaticWorkspaceClient("/data");

        await expect(client.getEntry("notes--one")).resolves.toMatchObject({ title: "notes/one.md" });
    });
});

function json(value: unknown): Response {
    return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}
