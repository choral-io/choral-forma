import type {
    DashboardEntrySummary,
    DashboardTaxonomy,
    DashboardViewSummary,
    ViewRenderOutput,
} from "@choral-forma/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import calendarFixture from "../../../shared/src/fixtures/calendar-core.json";
import ganttFixture from "../../../shared/src/fixtures/gantt-core.json";
import { RpcWorkspaceClient } from "./rpc-workspace-client";
import { createWorkspaceDashboardContext } from "./workspace-client";
import { readWorkspacePageGroup } from "./workspace-page-read";

async function contextFor(client: RpcWorkspaceClient) {
    return createWorkspaceDashboardContext(await client.getDashboard());
}

describe("RPC route generations", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("retries a mixed dashboard and Health once and uses the accepted generation for a View", async () => {
        const view = ".forma/views/release-scope";
        const requests = stubRouteRounds([
            ["workspace.dashboard", {}, "g1"],
            ["workspace.health", { expectedRouteGeneration: "g1" }, "g2"],
            ["workspace.dashboard", {}, "g2"],
            ["workspace.health", { expectedRouteGeneration: "g2" }, "g2"],
            ["view.render", { view, expectedRouteGeneration: "g2" }, "g2"],
        ]);
        const client = new RpcWorkspaceClient("/-/rpc");
        const page = await readWorkspacePageGroup(client, "/-/views/release-scope", () => true);
        expect(page?.dashboard.routeGeneration).toBe("g2");
        expect(page?.detail.view?.projection).toMatchObject({ kind: "gantt", canonicalLanguage: "zh-Hans" });
        expect(requests).toHaveLength(0);
    });

    it.each(["success", "failure"])("drops a late independent Health %s from an earlier epoch", async (outcome) => {
        let completeStale: (() => void) | undefined;
        const stale = new Promise<string>((resolve, reject) => {
            completeStale = () => {
                if (outcome === "success") resolve("g1");
                else reject(new Error("Delayed network failure"));
            };
        });
        const requests = stubRouteRounds([
            ["workspace.dashboard", {}, "g1"],
            ["workspace.health", { expectedRouteGeneration: "g1" }, "g1"],
            ["workspace.health", {}, stale],
            ["workspace.dashboard", {}, "g2"],
            ["workspace.health", { expectedRouteGeneration: "g2" }, "g2"],
        ]);
        const client = new RpcWorkspaceClient("/-/rpc");
        const invalidated = vi.fn();
        client.subscribeInvalidation(invalidated);
        await client.getDashboard();
        const oldHealth = expect(client.getHealth()).rejects.toMatchObject({ code: "route.superseded" });
        await expect(client.getDashboard()).resolves.toMatchObject({ routeGeneration: "g2" });
        completeStale?.();
        await oldHealth;
        expect(invalidated).not.toHaveBeenCalled();
        expect(requests).toHaveLength(0);
    });

    it("discards a View generated before its current dashboard and retries the complete group", async () => {
        const view = ".forma/views/release-scope";
        const requests = stubRouteRounds([
            ["workspace.dashboard", {}, "g2"],
            ["workspace.health", { expectedRouteGeneration: "g2" }, "g2"],
            ["view.render", { view, expectedRouteGeneration: "g2" }, "g1"],
            ["workspace.dashboard", {}, "g3"],
            ["workspace.health", { expectedRouteGeneration: "g3" }, "g3"],
            ["view.render", { view, expectedRouteGeneration: "g3" }, "g3"],
        ]);
        const client = new RpcWorkspaceClient("/-/rpc");
        await expect(readWorkspacePageGroup(client, "/-/views/release-scope", () => true)).resolves.toMatchObject({
            dashboard: { routeGeneration: "g3" },
            detail: { view: { projection: { kind: "gantt", canonicalLanguage: "zh-Hans" } } },
        });
        expect(requests).toHaveLength(0);
    });

    it("limits mixed generations to one retry and recovers following a fresh read", async () => {
        const requests = stubRouteRounds([
            ["workspace.dashboard", {}, "server1:g1"],
            ["workspace.health", { expectedRouteGeneration: "server1:g1" }, "server2:g1"],
            ["workspace.dashboard", {}, "server2:g1"],
            ["workspace.health", { expectedRouteGeneration: "server2:g1" }, "server2:g2"],
            ["workspace.dashboard", {}, "server2:g2"],
            ["workspace.health", { expectedRouteGeneration: "server2:g2" }, "server2:g2"],
        ]);
        const client = new RpcWorkspaceClient("/-/rpc");
        const read = () => readWorkspacePageGroup(client, "/", () => true);
        await expect(read()).rejects.toMatchObject({ code: "route.generationMismatch" });
        expect(requests).toHaveLength(2);
        await expect(read()).resolves.toMatchObject({ dashboard: { routeGeneration: "server2:g2" } });
        expect(requests).toHaveLength(0);
    });

    it("discards a successful old View after accepting a newly restarted server's dashboard", async () => {
        const view = ".forma/views/release-scope";
        let resolveOldView: ((generation: string) => void) | undefined;
        const oldView = new Promise<string>((resolve) => {
            resolveOldView = resolve;
        });
        const requests = stubRouteRounds([
            ["workspace.dashboard", {}, "old-session:1"],
            ["workspace.health", { expectedRouteGeneration: "old-session:1" }, "old-session:1"],
            ["view.render", { view, expectedRouteGeneration: "old-session:1" }, oldView],
            ["workspace.dashboard", {}, "new-session:1"],
            ["workspace.health", { expectedRouteGeneration: "new-session:1" }, "new-session:1"],
            ["view.render", { view, expectedRouteGeneration: "new-session:1" }, "new-session:1"],
        ]);
        const client = new RpcWorkspaceClient("/-/rpc");
        const invalidated = vi.fn();
        client.subscribeInvalidation(invalidated);
        const oldContext = await contextFor(client);
        const stale = expect(client.getViewRender(view, oldContext)).rejects.toMatchObject({
            code: "route.superseded",
        });
        const current = await contextFor(client);
        resolveOldView?.("old-session:1");
        await stale;
        await expect(client.getViewRender(view, current)).resolves.toMatchObject({ projection: { kind: "gantt" } });
        expect(invalidated).not.toHaveBeenCalled();
        expect(requests).toHaveLength(0);
    });
});

function stubRouteRounds(
    rounds: [method: string, params: Record<string, string>, generation: string | Promise<string>][],
) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
            if (typeof init.body !== "string") throw new Error("Expected a JSON RPC request body.");
            const request = JSON.parse(init.body) as {
                id: string;
                method: string;
                params: { view?: string };
            };
            const round = rounds.shift();
            if (!round) throw new Error(`Unexpected RPC call: ${request.method}`);
            const [method, params, generation] = round;
            expect(request.method).toBe(method);
            expect(request.params).toEqual(params);
            const viewId = ".forma/views/release-scope";
            const result = rpcResult(
                method,
                "",
                undefined,
                undefined,
                ganttFixture as ViewRenderOutput,
                [],
                [
                    {
                        id: viewId,
                        path: `${viewId}.md`,
                        configId: viewId,
                        routePath: "/-/views/release-scope",
                        kind: "gantt",
                        publicId: "release-scope",
                        sourcePath: `${viewId}.md`,
                    },
                ],
                [],
                request.params.view,
            ) as object;
            return Response.json({
                jsonrpc: "2.0",
                id: request.id,
                result: { ...result, routeGeneration: await generation, canonicalLanguage: "zh-Hans" },
            });
        }),
    );
    return rounds;
}

describe("RpcWorkspaceClient View rendering", () => {
    it.each([calendarFixture, ganttFixture])("preserves the Core $kind wire projection", async (fixture) => {
        const projection = fixture as ViewRenderOutput;
        stubRpc("", undefined, undefined, projection);
        const client = new RpcWorkspaceClient("/-/rpc");
        const result = await client.getViewRender(".forma/views/release-scope", await contextFor(client));
        expect(result.projection).toMatchObject(projection);
        expect(result.projection.kind).toBe(fixture.kind);
    });
    it("preserves Calendar temporal values and counts without treating them as Table data", async () => {
        const projection: ViewRenderOutput = {
            kind: "calendar",
            timeZone: "Asia/Shanghai",
            firstDayOfWeek: "monday",
            counts: { candidates: 1, scheduled: 1, unscheduled: 0, invalid: 0 },
            events: [
                {
                    path: "tasks/one.md",
                    title: "One",
                    classification: { label: "Painting", color: "#123456" },
                    firstDate: "2028-02-29",
                    afterLastDate: "2028-03-01",
                    temporal: { kind: "date", start: "2028-02-29", endExclusive: "2028-03-01" },
                },
            ],
            unscheduled: [],
        };
        stubRpc("", undefined, undefined, projection);
        const client = new RpcWorkspaceClient("/-/rpc");
        const result = await client.getViewRender(".forma/views/release-scope", await contextFor(client));
        expect(result.projection).toMatchObject(projection);
        expect(result.projection.kind).toBe("calendar");
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("preserves View Markdown around the projection mount", async () => {
        const marker = "<!-- forma:content -->";
        const bodySource = `\n# Release Scope\n\nRelease records and the validation material linked from them.\n\n${marker}\n\nAfter projection.\n`;
        const startOffset = bodySource.indexOf(marker);

        stubRpc(bodySource, startOffset, marker.length);

        const client = new RpcWorkspaceClient("/-/rpc");

        await expect(client.getViewRender(".forma/views/release-scope", await contextFor(client))).resolves.toEqual({
            document: {
                afterProjection: "\n\nAfter projection.\n",
                beforeProjection:
                    "\n# Release Scope\n\nRelease records and the validation material linked from them.\n\n",
                hasProjectionMount: true,
                path: ".forma/views/release-scope.md",
            },
            projection: {
                columns: [],
                items: [],
                kind: "table",
            },
        });
    });

    it("places the projection after the complete View body when no mount is present", async () => {
        const bodySource = "\n# Recent\n\nMost recently updated entries.\n";
        stubRpc(bodySource);

        const client = new RpcWorkspaceClient("/-/rpc");

        await expect(
            client.getViewRender(".forma/views/release-scope", await contextFor(client)),
        ).resolves.toMatchObject({
            document: {
                afterProjection: "",
                beforeProjection: bodySource,
                path: ".forma/views/release-scope.md",
            },
            projection: { kind: "table" },
        });
    });

    it("preserves configured Kanban card fields and dynamic columns", async () => {
        stubRpc("", undefined, undefined, {
            kind: "kanban",
            card: {
                titleField: "fields.title",
                subtitleFields: ["fields.summary", "fields.readiness"],
                badgeFields: ["fields.priority"],
            },
            columns: [
                {
                    id: "doing",
                    icon: "●",
                    label: "Doing",
                    items: [
                        {
                            path: "tasks/one.md",
                            title: "Fallback title",
                            fields: {
                                title: { kind: "value", value: "One" },
                                summary: { kind: "value", value: "Configured summary" },
                                priority: { kind: "value", value: "P1" },
                            },
                        },
                    ],
                },
                { id: "done", label: "Done", items: [] },
            ],
        });

        const client = new RpcWorkspaceClient("/-/rpc");

        await expect(client.getViewRender(".forma/views/task-board", await contextFor(client))).resolves.toMatchObject({
            projection: {
                kind: "kanban",
                card: {
                    titleField: "fields.title",
                    subtitleFields: ["fields.summary", "fields.readiness"],
                    badgeFields: ["fields.priority"],
                },
                columns: [
                    {
                        id: "doing",
                        icon: "●",
                        label: "Doing",
                        items: [
                            {
                                fields: { priority: "P1", summary: "Configured summary", title: "One" },
                                rawFields: {
                                    priority: { kind: "value", value: "P1" },
                                    summary: { kind: "value", value: "Configured summary" },
                                    title: { kind: "value", value: "One" },
                                },
                            },
                        ],
                    },
                    { id: "done", label: "Done", items: [] },
                ],
            },
        });
    });

    it("preserves normalized Table column presentation", async () => {
        stubRpc("", undefined, undefined, {
            kind: "table",
            columns: [
                {
                    field: "fields.title",
                    label: "Title",
                    width: "15rem",
                    minWidth: "12em",
                    maxWidth: "36em",
                    overflow: "wrap",
                },
                { field: "fields.summary", label: "Summary" },
            ],
            items: [],
        });

        const client = new RpcWorkspaceClient("/-/rpc");

        await expect(client.getViewRender(".forma/views/table", await contextFor(client))).resolves.toMatchObject({
            projection: {
                kind: "table",
                columns: [
                    {
                        field: "fields.title",
                        label: "Title",
                        width: "15rem",
                        minWidth: "12em",
                        maxWidth: "36em",
                        overflow: "wrap",
                    },
                    { field: "fields.summary", label: "Summary" },
                ],
            },
        });
    });

    it("preserves configured taxonomies without requiring spaces", async () => {
        stubRpc("", undefined, undefined, { kind: "table", columns: [], items: [] }, [
            {
                id: "topics",
                routePath: "/~/topics",
                title: "Topics",
                mode: "multiple",
                description: "Configured topics.",
                terms: [
                    {
                        id: "guides",
                        routePath: "/~/topics/guides",
                        title: "Guides",
                        description: "Configured guides.",
                        entryCount: 1,
                        status: "passed",
                        entries: [
                            {
                                id: "docs/getting-started",
                                path: "docs/getting-started.md",
                                rawPath: "docs/getting-started.md",
                                routePath: "/docs/getting-started",
                                title: "Getting Started",
                                summary: "First guide.",
                                status: "passed",
                                renderable: true,
                            },
                        ],
                    },
                ],
            },
        ]);

        const client = new RpcWorkspaceClient("/-/rpc");
        const dashboard = await client.getDashboard();

        expect(dashboard.spaces).toEqual([]);
        expect(dashboard.entries[0]).toMatchObject({
            id: "workspace-root",
            path: ".forma.md",
            routePath: "/",
            title: "Example",
            omitLeadingTitle: true,
            body: [{ type: "markdown", outline: [] }],
        });
        expect(dashboard.taxonomies).toMatchObject([
            {
                id: "topics",
                title: "Topics",
                mode: "multiple",
                terms: [
                    {
                        id: "guides",
                        title: "Guides",
                        entryCount: 1,
                        entries: [{ path: "docs/getting-started.md", title: "Getting Started" }],
                    },
                ],
            },
        ]);
    });

    it("preserves the configured View source path in the dashboard read model", async () => {
        stubRpc(
            "",
            undefined,
            undefined,
            undefined,
            [],
            [
                {
                    id: ".forma/views/release-scope",
                    path: ".forma/views/release-scope.md",
                    configId: ".forma/views/release-scope",
                    publicId: "release-scope",
                    routePath: "/-/views/release-scope",
                    sourcePath: ".forma/views/release-scope.md",
                    kind: "table",
                    title: "Release Scope",
                },
            ],
        );

        const client = new RpcWorkspaceClient("/-/rpc");
        const dashboard = await client.getDashboard();

        expect(dashboard.views).toMatchObject([
            {
                id: ".forma/views/release-scope",
                path: ".forma/views/release-scope.md",
                kind: "table",
                title: "Release Scope",
            },
        ]);
    });

    it("trims RPC titles and uses the entry path when a title is blank", async () => {
        stubRpc(
            "",
            undefined,
            undefined,
            undefined,
            [],
            [],
            [
                {
                    id: "notes/untitled",
                    path: "notes/untitled.md",
                    rawPath: "notes/untitled.md",
                    routePath: "/notes/untitled",
                    title: "   ",
                    status: "passed",
                    renderable: true,
                },
                {
                    id: "notes/titled",
                    path: "notes/titled.md",
                    rawPath: "notes/titled.md",
                    routePath: "/notes/titled",
                    title: "  Titled entry  ",
                    status: "passed",
                    renderable: true,
                },
            ],
        );

        const client = new RpcWorkspaceClient("/-/rpc");
        const dashboard = await client.getDashboard();

        expect(dashboard.entries.find((entry) => entry.path === "notes/untitled.md")?.title).toBe("notes/untitled.md");
        expect(dashboard.entries.find((entry) => entry.path === "notes/titled.md")?.title).toBe("Titled entry");
    });
});

function stubRpc(
    bodySource: string,
    startOffset?: number,
    markerLength?: number,
    render: ViewRenderOutput = { kind: "table", columns: [], items: [] },
    taxonomies: DashboardTaxonomy[] = [],
    views: DashboardViewSummary[] = [],
    entries: DashboardEntrySummary[] = [],
): void {
    vi.stubGlobal(
        "fetch",
        vi.fn((_input: string | URL | Request, requestInit?: RequestInit) => {
            if (typeof requestInit?.body !== "string") {
                throw new Error("Expected a JSON string RPC request body.");
            }
            const request = JSON.parse(requestInit.body) as {
                id: string;
                method: string;
                params: { view?: string };
            };
            const result = rpcResult(
                request.method,
                bodySource,
                startOffset,
                markerLength,
                render,
                taxonomies,
                views,
                entries,
                request.params.view,
            );

            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ jsonrpc: "2.0", id: request.id, result }),
            } as Response);
        }),
    );
}

function rpcResult(
    method: string,
    bodySource: string,
    startOffset: number | undefined,
    markerLength: number | undefined,
    render: ViewRenderOutput,
    taxonomies: DashboardTaxonomy[],
    views: DashboardViewSummary[],
    entries: DashboardEntrySummary[],
    viewId?: string,
): unknown {
    if (method === "workspace.dashboard") {
        return {
            schemaVersion: 1,
            routeProjectionVersion: 1,
            routeGeneration: "fixture-generation",
            canonicalLanguage: "en",
            directories: [],
            operation: method,
            status: "passed",
            summary: { errors: 0, warnings: 0, infos: 0 },
            workspace: { root: ".", name: "Example" },
            home: {
                path: ".forma.md",
                title: "Example",
                omitLeadingTitle: true,
                markdown: "# Example",
                headings: [{ id: "example", level: 1, text: "Example" }],
            },
            taxonomies,
            spaces: [],
            entries,
            views,
            diagnostics: [],
        };
    }

    if (method === "workspace.health") {
        return {
            schemaVersion: 1,
            routeGeneration: "fixture-generation",
            operation: method,
            status: "passed",
            summary: { errors: 0, warnings: 0, infos: 0 },
            workspace: { root: ".", name: "Example" },
            findings: [],
            diagnostics: [],
        };
    }

    if (method === "view.render") {
        if (!viewId) throw new Error("Expected a View configuration ID.");
        return {
            schemaVersion: 1,
            routeGeneration: "fixture-generation",
            operation: method,
            status: "passed",
            summary: { errors: 0, warnings: 0, infos: 0 },
            workspace: { root: ".", name: "Example" },
            view: {
                id: viewId,
                path: `${viewId}.md`,
                surface: "page",
                mode: "table",
                title: "Release Scope",
            },
            document: {
                bodySource,
                ...(startOffset === undefined || markerLength === undefined
                    ? {}
                    : {
                          mounts: [
                              {
                                  kind: "content",
                                  startOffset,
                                  endOffset: startOffset + markerLength,
                                  location: { kind: "body", line: 5, column: 1 },
                              },
                          ],
                      }),
            },
            render,
            diagnostics: [],
        };
    }

    throw new Error(`Unexpected RPC method: ${method}`);
}
