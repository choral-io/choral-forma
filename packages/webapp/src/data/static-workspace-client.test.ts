import { afterEach, describe, expect, it, vi } from "vitest";

import calendarFixture from "../../../shared/src/fixtures/calendar-core.json";
import ganttFixture from "../../../shared/src/fixtures/gantt-core.json";
import { type StaticRouteTarget, type StaticRuntimeConfig } from "./static-runtime";
import { StaticWorkspaceClient, type StaticDashboardData } from "./static-workspace-client";
import { createWorkspaceDashboardContext } from "./workspace-client";

async function contextFor(client: StaticWorkspaceClient) {
    return createWorkspaceDashboardContext(await client.getDashboard());
}

const artifactId = "a".repeat(64);
const entryDataPath = `entries/${"1".repeat(64)}.json`;
const variantDataPath = `entries/${"2".repeat(64)}.json`;
const viewDataPath = `views/${"3".repeat(64)}.json`;
const entryTarget: StaticRouteTarget = {
    kind: "entry",
    id: "notes/one.md",
    sourcePath: "notes/one.md",
    path: "/notes/one.md",
    outputPath: "notes/one.md/index.html",
};
function config(rootPath = "/"): StaticRuntimeConfig {
    return {
        runtimeVersion: 1,
        dataSchemaVersion: 4,
        artifactId,
        baseUrl: "https://fixture.example",
        rootPath,
        dataBaseUrl: `${rootPath === "/" ? "" : rootPath}/-/data/${artifactId}`,
        pageRoutePath: entryTarget.path,
        pageTarget: entryTarget,
    };
}
const { dataBaseUrl } = config();
const previewBase = config("/preview").dataBaseUrl;

const localizedVariant = {
    id: "notes--one.zh-hans",
    language: "zh-Hans",
    path: "notes/one.zh-Hans.md",
    routePath: "/notes/one.zh-Hans.md",
    title: "一",
    omitLeadingTitle: false,
    dataPath: variantDataPath,
};

const dashboard: StaticDashboardData = {
    schemaVersion: 4,
    artifactId,
    routes: [entryTarget],
    directories: [],
    generatorVersion: "test",
    status: "passed",
    workspace: {
        name: "Static fixture",
        canonicalLanguage: "en",
        supportedLanguages: ["en", "zh-Hans"],
        home: {
            path: ".forma.md",
            title: "Static fixture",
            omitLeadingTitle: true,
            markdown: "# Static fixture",
            headings: [{ id: "static-fixture", level: 1, text: "Static fixture" }],
        },
    },
    spaces: [
        {
            id: "notes",
            title: "Notes",
            entryPaths: ["notes/one.md"],
        },
    ],
    taxonomies: [],
    entries: [
        {
            id: "notes--one",
            path: "notes/one.md",
            routePath: "/notes/one.md",
            space: "notes",
            title: "One",
            omitLeadingTitle: false,
            status: "passed",
            variants: [localizedVariant],
            dataPath: entryDataPath,
        },
    ],
    views: [
        {
            id: "notes",
            configId: ".forma/views/notes.md",
            publicId: "notes",
            sourcePath: "config/notes.md",
            routePath: "/-/views/notes",
            mode: "list",
            title: "Notes",
            status: "passed",
            dataPath: viewDataPath,
        },
    ],
    summary: { errors: 0, warnings: 0, infos: 0 },
    diagnostics: [],
};

describe("StaticWorkspaceClient", () => {
    it.each([calendarFixture, ganttFixture])("preserves the Core $kind wire projection", async (fixture) => {
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) =>
                path === `${dataBaseUrl}/dashboard.json`
                    ? json(dashboard)
                    : json({
                          ...dashboard.views[0],
                          mode: fixture.kind,
                          document: { bodySource: "" },
                          projection: fixture,
                      }),
            ),
        );
        const client = new StaticWorkspaceClient(config());
        const result = await client.getViewRender(".forma/views/notes.md", await contextFor(client));
        expect(result.projection).toMatchObject(fixture);
        expect(result.projection.kind).toBe(fixture.kind);
    });
    afterEach(() => vi.unstubAllGlobals());

    it.each([false, true])("loads a View with heading metadata present: %s", async (withHeadings) => {
        const marker = "<!-- forma:content -->";
        const beforeProjection = "## Repeat\n\n";
        const afterProjection = "\n\n## Repeat";
        const headings = withHeadings
            ? {
                  beforeProjection: [{ id: "repeat", level: 2, text: "Repeat", aliasId: "forma-heading-repeat" }],
                  afterProjection: [{ id: "repeat-2", level: 2, text: "Repeat", aliasId: "forma-heading-repeat-2" }],
              }
            : undefined;
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) =>
                path === `${dataBaseUrl}/dashboard.json`
                    ? json(dashboard)
                    : json({
                          ...dashboard.views[0],
                          sourcePath: "config/notes.md",
                          document: {
                              bodySource: `${beforeProjection}${marker}${afterProjection}`,
                              mounts: [
                                  {
                                      kind: "content",
                                      startOffset: beforeProjection.length,
                                      endOffset: beforeProjection.length + marker.length,
                                      location: { kind: "body", line: 3, column: 1 },
                                  },
                              ],
                              ...(headings ? { headings } : {}),
                          },
                          projection: { kind: "list", items: [] },
                      }),
            ),
        );
        const client = new StaticWorkspaceClient(config());
        const result = await client.getViewRender(".forma/views/notes.md", await contextFor(client));
        expect(result.document).toEqual({
            beforeProjection,
            afterProjection,
            hasProjectionMount: true,
            headings,
            path: "config/notes.md",
        });
    });

    it("preserves Calendar semantics and resolves source navigation", async () => {
        const projection = {
            kind: "calendar",
            timeZone: "Pacific/Auckland",
            firstDayOfWeek: "sunday",
            counts: { candidates: 1, scheduled: 1, unscheduled: 0, invalid: 0 },
            events: [
                {
                    path: "notes/one.md",
                    title: "One",
                    classification: { label: "Painting", color: "#123456" },
                    temporal: { kind: "date", start: "2028-02-29", endExclusive: "2028-03-02" },
                    firstDate: "2028-02-29",
                    afterLastDate: "2028-03-02",
                },
            ],
            unscheduled: [],
        };
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) => {
                if (path === `${dataBaseUrl}/dashboard.json`) return json(dashboard);
                return json({ ...dashboard.views[0], mode: "calendar", document: { bodySource: "" }, projection });
            }),
        );
        const client = new StaticWorkspaceClient(config());
        const result = await client.getViewRender(".forma/views/notes.md", await contextFor(client));
        expect(result.projection).toEqual({
            ...projection,
            routes: { "notes/one.md": "/notes/one.md", ".forma.md": "/" },
        });
    });

    it("links backlinks to their source and distinguishes external links from unresolved references", async () => {
        const sourceEntry = {
            ...dashboard.entries[0],
            id: "notes--source",
            path: "notes/source.md",
            routePath: "/notes/source.md",
            title: "Source",
            variants: [],
            dataPath: `entries/${"4".repeat(64)}.json`,
        };
        const backlink = {
            sourcePath: sourceEntry.path,
            sourceTitle: "Source",
            targetPath: entryTarget.sourcePath,
            targetTitle: "One",
        };
        const detail = {
            ...dashboard.entries[0],
            markdown: "# One",
            headings: [],
            backlinks: [backlink],
            outgoing: [
                {
                    ...backlink,
                    sourcePath: entryTarget.sourcePath,
                    targetPath: sourceEntry.path,
                    targetTitle: "Source",
                },
                {
                    ...backlink,
                    sourcePath: entryTarget.sourcePath,
                    targetPath: "https://example.com/docs",
                    targetTitle: "Docs",
                },
                {
                    ...backlink,
                    sourcePath: entryTarget.sourcePath,
                    targetPath: "notes/missing.md",
                    targetTitle: "Missing",
                },
            ],
        };
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) =>
                path === `${dataBaseUrl}/dashboard.json`
                    ? json({ ...dashboard, entries: [...dashboard.entries, sourceEntry] })
                    : json(detail),
            ),
        );
        const client = new StaticWorkspaceClient(config());
        const result = await client.getEntry("notes/one.md", await contextFor(client));
        const sourceLink = {
            kind: "internal",
            label: "Source",
            targetEntryId: sourceEntry.id,
            targetRoutePath: sourceEntry.routePath,
            targetPath: sourceEntry.path,
        };
        expect(result.relations).toEqual({
            backlinks: [sourceLink],
            outgoing: [
                sourceLink,
                { kind: "external", label: "Docs", targetPath: "https://example.com/docs" },
                { kind: "unresolved", label: "Missing", targetPath: "notes/missing.md" },
            ],
        });
    });

    it("uses generated local data with an explicit artifact base", async () => {
        const fetch = vi.fn((path: string) => {
            if (path === `${previewBase}/dashboard.json`) return json(dashboard);
            if (path === `${previewBase}/${entryDataPath}`) {
                return json({
                    ...dashboard.entries[0],
                    markdown: "# One",
                    html: "<h1>One</h1>",
                    headings: [],
                    outgoing: [],
                    backlinks: [],
                });
            }
            if (path === `${previewBase}/${variantDataPath}`) {
                return json({
                    ...localizedVariant,
                    markdown: "# 一",
                    html: '<h1 id="一">一</h1>',
                    headings: [{ id: "段落", level: 2, text: "段落" }],
                });
            }
            if (path === `${previewBase}/${viewDataPath}`) {
                return json({
                    ...dashboard.views[0],
                    sourcePath: "config/notes.md",
                    document: { bodySource: "" },
                    projection: { kind: "list", items: [] },
                });
            }
            return new Response(null, { status: 404 });
        });
        vi.stubGlobal("fetch", fetch);
        const client = new StaticWorkspaceClient(config("/preview"));

        const loadedDashboard = await client.getDashboard();
        expect(loadedDashboard.workspaceName).toBe("Static fixture");
        expect(loadedDashboard.entries.find((entry) => entry.path === ".forma.md")).toMatchObject({
            id: "workspace-root",
            routePath: "/",
            title: "Static fixture",
            omitLeadingTitle: true,
        });
        await expect(client.getEntry("notes/one.md", await contextFor(client))).resolves.toMatchObject({
            title: "One",
        });
        await expect(client.getEntry("notes/one.zh-Hans.md", await contextFor(client))).resolves.toMatchObject({
            id: "notes--one.zh-hans",
            path: "notes/one.zh-Hans.md",
            routePath: "/notes/one.zh-Hans.md",
            title: "一",
        });
        await expect(client.getViewRender(".forma/views/notes.md", await contextFor(client))).resolves.toMatchObject({
            document: { path: "config/notes.md" },
            projection: { kind: "list" },
        });
        expect(fetch).toHaveBeenCalledWith(`${previewBase}/dashboard.json`);
        expect(fetch).toHaveBeenCalledWith(`${previewBase}/${entryDataPath}`);
        expect(fetch).toHaveBeenCalledWith(`${previewBase}/${variantDataPath}`);
        expect(fetch).toHaveBeenCalledWith(`${previewBase}/${viewDataPath}`);
    });

    it("uses the registered path for a View with encoded route boundaries", async () => {
        const view = {
            ...dashboard.views[0],
            configId: ".forma/views/folder/a b!'()*.md",
            publicId: "a b!'()*",
            routePath: "/-/views/a%20b%21%27%28%29%2A",
        };
        const fetch = vi.fn((path: string) => {
            if (path === `${previewBase}/dashboard.json`) return json({ ...dashboard, views: [view] });
            if (path === `${previewBase}/${viewDataPath}`) {
                return json({ ...view, document: { bodySource: "" }, projection: { kind: "list", items: [] } });
            }
            return new Response(null, { status: 404 });
        });
        vi.stubGlobal("fetch", fetch);
        const client = new StaticWorkspaceClient(config("/preview"));
        await expect(client.getViewRender(view.configId, await contextFor(client))).resolves.toMatchObject({
            projection: { kind: "list" },
        });
        expect(fetch).toHaveBeenCalledWith(`${previewBase}/${viewDataPath}`);
    });

    it("keeps static HTML when runtime and manifest locate different targets", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => json(dashboard)),
        );
        const client = new StaticWorkspaceClient({ ...config(), pageTarget: { ...entryTarget, id: "notes/other.md" } });
        await expect(client.verifyStaticBootstrap(entryTarget.path)).rejects.toThrow("HTML did not match");
    });

    it("checks the artifact envelope and rejects a swapped detail before caching", async () => {
        const detail = { ...dashboard.entries[0], markdown: "# One", headings: [] };
        const fetch = vi
            .fn()
            .mockReturnValueOnce(json(dashboard))
            .mockReturnValueOnce(json({ ...detail, artifactId: "b".repeat(64) }))
            .mockReturnValueOnce(json({ ...detail, path: "notes/other.md" }))
            .mockReturnValueOnce(json(detail));
        vi.stubGlobal("fetch", fetch);
        const client = new StaticWorkspaceClient(config("/preview"));
        await client.verifyStaticBootstrap(entryTarget.path);
        await expect(client.prepareStaticRoute(entryTarget.path)).rejects.toThrow("did not match the build");
        await expect(client.prepareStaticRoute(entryTarget.path)).rejects.toThrow("identity did not match");
        await expect(client.prepareStaticRoute(entryTarget.path)).resolves.toBeUndefined();
        await expect(client.getEntry(entryTarget.id, await contextFor(client))).resolves.toMatchObject({
            title: "One",
        });
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it("rejects mismatched manifest and HTML schema versions before loading details", async () => {
        const fetch = vi.fn(() => json({ ...dashboard, schemaVersion: 3 }));
        vi.stubGlobal("fetch", fetch);
        const oldClient = new StaticWorkspaceClient({ ...config(), dataSchemaVersion: 3 });
        await expect(oldClient.verifyStaticBootstrap(entryTarget.path)).rejects.toThrow("unsupported format");
        const client = new StaticWorkspaceClient(config());
        await expect(client.verifyStaticBootstrap(entryTarget.path)).rejects.toThrow("did not match the build");
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("rejects competing detail files and details carrying a failed status", async () => {
        const repeated = { ...dashboard.entries[0], path: "notes/other.md", routePath: "/notes/other.md" };
        const invalid = { ...dashboard, entries: [...dashboard.entries, repeated] };
        const fetch = vi
            .fn()
            .mockReturnValueOnce(json(invalid))
            .mockReturnValueOnce(json(dashboard))
            .mockReturnValueOnce(json({ ...dashboard.entries[0], status: "failed", markdown: "# One", headings: [] }));
        vi.stubGlobal("fetch", fetch);
        const client = new StaticWorkspaceClient(config());
        await expect(client.getDashboard()).rejects.toThrow("competing or invalid data paths");
        await client.verifyStaticBootstrap(entryTarget.path);
        await expect(client.prepareStaticRoute(entryTarget.path)).rejects.toThrow("entry payload is invalid");
    });

    it("reports missing artifact data without an RPC fallback", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) =>
                path === `${dataBaseUrl}/dashboard.json` ? json(dashboard) : new Response(null, { status: 404 }),
            ),
        );
        const client = new StaticWorkspaceClient(config());
        await expect(client.getEntry("notes/one.md", await contextFor(client))).rejects.toThrow(
            `Static artifact data missing: ${dataBaseUrl}/${entryDataPath} (HTTP 404)`,
        );
        await expect(client.getViewRender(".forma/views/notes.md", await contextFor(client))).rejects.toThrow(
            `Static artifact data missing: ${dataBaseUrl}/${viewDataPath} (HTTP 404)`,
        );
        vi.stubGlobal(
            "fetch",
            vi.fn(() => new Response(null, { status: 404 })),
        );
        const missingDashboardClient = new StaticWorkspaceClient(config());
        await expect(missingDashboardClient.getDashboard()).rejects.toThrow(
            `Static artifact data missing: ${dataBaseUrl}/dashboard.json (HTTP 404)`,
        );
    });

    it("keeps fetch failures as the cause of a static-artifact diagnostic", async () => {
        const cause = new TypeError("offline");
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.reject(cause)),
        );
        const client = new StaticWorkspaceClient(config());

        await expect(client.getDashboard()).rejects.toMatchObject({
            cause,
            message: `Static artifact data missing: ${dataBaseUrl}/dashboard.json`,
        });
    });

    it("falls back to an empty list when View projection data is absent", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) => {
                if (path === `${dataBaseUrl}/dashboard.json`) return json(dashboard);
                if (path === `${dataBaseUrl}/${viewDataPath}`)
                    return json({ ...dashboard.views[0], document: { bodySource: "" } });
                return new Response(null, { status: 404 });
            }),
        );
        const client = new StaticWorkspaceClient(config());

        await expect(client.getViewRender(".forma/views/notes.md", await contextFor(client))).resolves.toMatchObject({
            projection: { items: [], kind: "list" },
        });
    });

    it("keeps an empty Kanban list field empty instead of rendering JSON brackets", async () => {
        const kanbanView = { ...dashboard.views[0], mode: "kanban" };
        vi.stubGlobal(
            "fetch",
            vi.fn((path: string) => {
                if (path === `${dataBaseUrl}/dashboard.json`) return json({ ...dashboard, views: [kanbanView] });
                if (path === `${dataBaseUrl}/${viewDataPath}`) {
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
        const client = new StaticWorkspaceClient(config());

        const render = await client.getViewRender(".forma/views/notes.md", await contextFor(client));
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
                if (path === `${dataBaseUrl}/dashboard.json`) return json(blankTitleDashboard);
                if (path === `${dataBaseUrl}/${entryDataPath}`) {
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
        const client = new StaticWorkspaceClient(config());

        await expect(client.getEntry("notes/one.md", await contextFor(client))).resolves.toMatchObject({
            title: "notes/one.md",
        });
    });
});

function json(value: object): Response {
    return new Response(JSON.stringify({ schemaVersion: 4, artifactId, ...value }), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}
