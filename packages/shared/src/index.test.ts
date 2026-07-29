import { describe, expect, it } from "vitest";

import {
    DISPLAY_ICON_IDS,
    FormaRpcClient,
    FormaRpcError,
    isSupportedDisplayIcon,
    normalizeDisplayColor,
} from "./index";

describe("Forma presentation contracts", () => {
    it("keeps the provider-neutral display icon registry stable and unique", () => {
        const sortedIconIds = [...DISPLAY_ICON_IDS];
        sortedIconIds.sort();
        expect(DISPLAY_ICON_IDS).toEqual(sortedIconIds);
        expect(new Set(DISPLAY_ICON_IDS).size).toBe(DISPLAY_ICON_IDS.length);
        expect(isSupportedDisplayIcon("list-checks")).toBe(true);
        expect(isSupportedDisplayIcon("../workspace-icon")).toBe(false);
    });

    it("accepts only portable #RRGGBB colors and normalizes their case", () => {
        expect(normalizeDisplayColor("#4F7CAC")).toBe("#4f7cac");
        expect(normalizeDisplayColor("#4f7cac")).toBe("#4f7cac");
        expect(normalizeDisplayColor("red")).toBeUndefined();
        expect(normalizeDisplayColor("#fff")).toBeUndefined();
        expect(normalizeDisplayColor("var(--color)")).toBeUndefined();
    });
});

describe("FormaRpcClient", () => {
    it("sends JSON-RPC requests with incrementing string ids", async () => {
        const calls: Array<{ input: string; body: unknown }> = [];
        const client = new FormaRpcClient("/rpc", (input, requestInit) => {
            calls.push({ input, body: JSON.parse(requestInit.body) });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        jsonrpc: "2.0",
                        id: "1",
                        result: { schemaVersion: 1, operation: "check", status: "passed" },
                    }),
            });
        });

        await expect(client.check()).resolves.toMatchObject({
            operation: "check",
            status: "passed",
        });

        expect(calls).toEqual([
            {
                input: "/rpc",
                body: {
                    jsonrpc: "2.0",
                    id: "1",
                    method: "check",
                    params: {},
                },
            },
        ]);
    });

    it("throws FormaRpcError for JSON-RPC failures", async () => {
        const client = new FormaRpcClient("/rpc", () =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        jsonrpc: "2.0",
                        id: "1",
                        error: {
                            code: -32602,
                            message: "Invalid params",
                            data: { code: "invalid_params" },
                        },
                    }),
            }),
        );

        const result = expect(client.check()).rejects;
        await result.toBeInstanceOf(FormaRpcError);
        await result.toMatchObject({
            name: "FormaRpcError",
            code: -32602,
            dataCode: "invalid_params",
        });
    });

    it("requests markdown file renders by default", async () => {
        const calls: Array<{ input: string; body: unknown }> = [];
        const client = new FormaRpcClient("/rpc", (input, requestInit) => {
            calls.push({ input, body: JSON.parse(requestInit.body) });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        jsonrpc: "2.0",
                        id: "1",
                        result: {
                            schemaVersion: 1,
                            operation: "file.render",
                            status: "passed",
                            render: { format: "markdown", markdown: "# Title", refs: [] },
                        },
                    }),
            });
        });

        await client.renderFile("notes/title.md");

        expect(calls[0]?.body).toMatchObject({
            method: "file.render",
            params: {
                path: "notes/title.md",
                format: "markdown",
            },
        });
    });

    it("requests built-in docs without workspace params", async () => {
        const calls: Array<{ body: unknown }> = [];
        const client = new FormaRpcClient("/rpc", (_input, requestInit) => {
            calls.push({ body: JSON.parse(requestInit.body) });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        jsonrpc: "2.0",
                        id: "1",
                        result: {
                            schemaVersion: 1,
                            operation: "docs.list",
                            status: "passed",
                            docs: [],
                        },
                    }),
            });
        });

        await expect(client.docsList()).resolves.toMatchObject({ operation: "docs.list" });
        await client.docsGet("agents.forma-cli-core");

        expect(calls).toEqual([
            {
                body: {
                    jsonrpc: "2.0",
                    id: "1",
                    method: "docs.list",
                    params: {},
                },
            },
            {
                body: {
                    jsonrpc: "2.0",
                    id: "2",
                    method: "docs.get",
                    params: { id: "agents.forma-cli-core" },
                },
            },
        ]);
    });

    it("requests read-only workspace health without params", async () => {
        const calls: Array<{ input: string; body: unknown }> = [];
        const client = new FormaRpcClient("/rpc", (input, requestInit) => {
            calls.push({ input, body: JSON.parse(requestInit.body) });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        jsonrpc: "2.0",
                        id: "1",
                        result: {
                            schemaVersion: 1,
                            operation: "workspace.health",
                            status: "warning",
                            workspace: { root: ".", name: "Example" },
                            findings: [
                                {
                                    category: "brokenReference",
                                    severity: "warning",
                                    path: "notes/source.md",
                                    message: "Reference cannot be resolved.",
                                    target: "notes/missing",
                                },
                            ],
                        },
                    }),
            });
        });

        await expect(client.workspaceHealth()).resolves.toMatchObject({
            findings: [
                {
                    category: "brokenReference",
                    path: "notes/source.md",
                },
            ],
            operation: "workspace.health",
        });

        expect(calls[0]?.body).toMatchObject({
            method: "workspace.health",
            params: {},
        });
    });

    it("requests canonical reference resolution with an optional fragment", async () => {
        const calls: Array<{ body: unknown }> = [];
        const client = new FormaRpcClient("/rpc", (_input, requestInit) => {
            calls.push({ body: JSON.parse(requestInit.body) });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        jsonrpc: "2.0",
                        id: "1",
                        result: {
                            schemaVersion: 1,
                            operation: "reference.resolve",
                            status: "passed",
                            target: { path: "notes/target.md", space: "notes" },
                        },
                    }),
            });
        });

        await client.resolveReference("notes/source.md", "target", "link", "Details");

        expect(calls[0]?.body).toMatchObject({
            method: "reference.resolve",
            params: {
                sourcePath: "notes/source.md",
                target: "target",
                intent: "link",
                fragment: "Details",
            },
        });
    });
});
