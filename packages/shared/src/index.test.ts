import { describe, expect, it } from "vitest";

import { FormaRpcClient, FormaRpcError } from "./index";

describe("FormaRpcClient", () => {
    it("sends JSON-RPC requests with incrementing string ids", async () => {
        const calls: Array<{ input: string; body: unknown }> = [];
        const client = new FormaRpcClient("/rpc", (input, init) => {
            calls.push({ input, body: JSON.parse(init.body) });
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
        const client = new FormaRpcClient("/rpc", (input, init) => {
            calls.push({ input, body: JSON.parse(init.body) });
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
});
