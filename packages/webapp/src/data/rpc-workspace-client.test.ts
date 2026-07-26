import type {
    DashboardEntrySummary,
    DashboardTaxonomy,
    DashboardViewSummary,
    ViewRenderOutput,
} from "@choral-forma/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RpcWorkspaceClient } from "./rpc-workspace-client";

describe("RpcWorkspaceClient View rendering", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("preserves View Markdown around the projection mount", async () => {
        const marker = "<!-- forma:content -->";
        const bodySource = `\n# Release Scope\n\nRelease records and the validation material linked from them.\n\n${marker}\n\nAfter projection.\n`;
        const startOffset = bodySource.indexOf(marker);

        stubRpc(bodySource, startOffset, marker.length);

        const client = new RpcWorkspaceClient("/rpc");

        await expect(client.getViewRender(".forma/views/release-scope")).resolves.toEqual({
            document: {
                afterProjection: "\n\nAfter projection.\n",
                beforeProjection:
                    "\n# Release Scope\n\nRelease records and the validation material linked from them.\n\n",
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

        const client = new RpcWorkspaceClient("/rpc");

        await expect(client.getViewRender(".forma/views/release-scope")).resolves.toMatchObject({
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
                            fields: { title: "One", summary: "Configured summary", priority: "P1" },
                        },
                    ],
                },
                { id: "done", label: "Done", items: [] },
            ],
        });

        const client = new RpcWorkspaceClient("/rpc");

        await expect(client.getViewRender(".forma/views/task-board")).resolves.toMatchObject({
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
                                rawFields: { priority: "P1", summary: "Configured summary", title: "One" },
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

        const client = new RpcWorkspaceClient("/rpc");

        await expect(client.getViewRender(".forma/views/table")).resolves.toMatchObject({
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
                title: "Topics",
                mode: "multiple",
                description: "Configured topics.",
                terms: [
                    {
                        id: "guides",
                        title: "Guides",
                        description: "Configured guides.",
                        entryCount: 1,
                        status: "passed",
                        entries: [
                            {
                                id: "docs/getting-started",
                                path: "docs/getting-started.md",
                                rawPath: "docs/getting-started.md",
                                routePath: "/pages/docs/getting-started",
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

        const client = new RpcWorkspaceClient("/rpc");
        const dashboard = await client.getDashboard();

        expect(dashboard.spaces).toEqual([]);
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
                    kind: "table",
                    title: "Release Scope",
                },
            ],
        );

        const client = new RpcWorkspaceClient("/rpc");
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
                    routePath: "/pages/notes/untitled",
                    title: "   ",
                    status: "passed",
                    renderable: true,
                },
                {
                    id: "notes/titled",
                    path: "notes/titled.md",
                    rawPath: "notes/titled.md",
                    routePath: "/pages/notes/titled",
                    title: "  Titled entry  ",
                    status: "passed",
                    renderable: true,
                },
            ],
        );

        const client = new RpcWorkspaceClient("/rpc");
        const dashboard = await client.getDashboard();

        expect(dashboard.entries[0]?.title).toBe("notes/untitled.md");
        expect(dashboard.entries[1]?.title).toBe("Titled entry");
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
): unknown {
    if (method === "workspace.dashboard") {
        return {
            schemaVersion: 1,
            operation: method,
            status: "passed",
            summary: { errors: 0, warnings: 0, infos: 0 },
            workspace: { root: ".", name: "Example" },
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
            operation: method,
            status: "passed",
            summary: { errors: 0, warnings: 0, infos: 0 },
            workspace: { root: ".", name: "Example" },
            findings: [],
            diagnostics: [],
        };
    }

    if (method === "view.render") {
        return {
            schemaVersion: 1,
            operation: method,
            status: "passed",
            summary: { errors: 0, warnings: 0, infos: 0 },
            workspace: { root: ".", name: "Example" },
            view: {
                id: ".forma/views/release-scope",
                path: ".forma/views/release-scope.md",
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
