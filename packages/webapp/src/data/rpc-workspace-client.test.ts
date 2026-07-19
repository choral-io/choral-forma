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
});

function stubRpc(bodySource: string, startOffset?: number, markerLength?: number): void {
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
            const result = rpcResult(request.method, bodySource, startOffset, markerLength);

            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ jsonrpc: "2.0", id: request.id, result }),
            } as Response);
        }),
    );
}

function rpcResult(method: string, bodySource: string, startOffset?: number, markerLength?: number): unknown {
    if (method === "workspace.dashboard") {
        return {
            schemaVersion: 1,
            operation: method,
            status: "passed",
            summary: { errors: 0, warnings: 0, infos: 0 },
            workspace: { root: ".", name: "Example" },
            spaces: [],
            entries: [],
            views: [],
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
                mounts:
                    startOffset === undefined || markerLength === undefined
                        ? []
                        : [
                              {
                                  kind: "content",
                                  startOffset,
                                  endOffset: startOffset + markerLength,
                                  location: { kind: "body", line: 5, column: 1 },
                              },
                          ],
            },
            render: { kind: "table", columns: [], items: [] },
            diagnostics: [],
        };
    }

    throw new Error(`Unexpected RPC method: ${method}`);
}
