import { describe, expect, it, vi } from "vitest";

import {
    FormaLspLifecycle,
    RestartBudget,
    formaLspCommand,
    formaLspDocumentPatterns,
    formaLspDocumentSelector,
    formaLspExecutable,
    formaLspInitializationOptions,
    type FormaLspClient,
    type FormaLspRuntimeContext,
} from "./lsp-lifecycle.ts";

function context(root: string): FormaLspRuntimeContext {
    return {
        command: "/opt/forma/bin/forma",
        root,
        rootUri: `file://${root}`,
        includePatterns: ["notes/**/*.md", "notes/**/*.md"],
        configPatterns: [".forma/views/*.md"],
        configSourcePaths: [".forma.md", ".forma/views/board.md"],
    };
}

function fakeClient(): FormaLspClient & {
    start: ReturnType<typeof vi.fn<FormaLspClient["start"]>>;
    stop: ReturnType<typeof vi.fn<FormaLspClient["stop"]>>;
    dispose: ReturnType<typeof vi.fn<FormaLspClient["dispose"]>>;
} {
    return {
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        dispose: vi.fn(async () => undefined),
    };
}

describe("Forma LSP lifecycle", () => {
    it("constructs the release-aligned workspace command and managed selector patterns", () => {
        expect(formaLspCommand(context("/repo"))).toEqual({
            command: "/opt/forma/bin/forma",
            args: ["--workspace", "/repo", "lsp"],
            cwd: "/repo",
        });
        expect(formaLspExecutable(context("/repo"))).toEqual({
            command: "/opt/forma/bin/forma",
            args: ["--workspace", "/repo", "lsp"],
            options: { cwd: "/repo", shell: false, detached: false },
        });
        expect(formaLspExecutable(context("/repo"))).not.toHaveProperty("transport");
        expect(formaLspDocumentPatterns(context("/repo"))).toEqual([
            ".forma.md",
            ".forma/views/*.md",
            ".forma/views/board.md",
            "notes/**/*.md",
        ]);
        expect(formaLspDocumentSelector(context("/repo"))[0]).toEqual({
            language: "markdown",
            scheme: "file",
            pattern: { baseUri: "file:///repo", pattern: ".forma.md" },
        });
        expect(formaLspInitializationOptions()).toEqual({ clientProfile: "vscode" });
    });

    it("keeps one client, switches roots in stop-before-start order, and disposes cleanly", async () => {
        const calls: string[] = [];
        const clients: FormaLspClient[] = [];
        const lifecycle = new FormaLspLifecycle((runtime) => {
            const client: FormaLspClient = {
                start: async () => {
                    calls.push(`start:${runtime.root}`);
                },
                stop: async () => {
                    calls.push(`stop:${runtime.root}`);
                },
                dispose: async () => {
                    calls.push(`dispose:${runtime.root}`);
                },
            };
            clients.push(client);
            return client;
        });

        await lifecycle.sync(context("/one"));
        await lifecycle.sync(context("/one"));
        await lifecycle.sync(context("/two"));
        expect(clients).toHaveLength(2);
        expect(calls).toEqual(["start:/one", "stop:/one", "dispose:/one", "start:/two"]);
        expect(lifecycle.activeRoot).toBe("/two");

        await lifecycle.disposeAsync();
        expect(calls).toEqual(["start:/one", "stop:/one", "dispose:/one", "start:/two", "stop:/two", "dispose:/two"]);
        expect(lifecycle.state).toBe("stopped");
    });

    it("cancels an in-flight start when a newer root wins", async () => {
        let releaseStart: (() => void) | undefined;
        const first = fakeClient();
        first.start.mockImplementation(async (signal) => {
            await new Promise<void>((resolve) => {
                releaseStart = resolve;
                signal.addEventListener(
                    "abort",
                    () => {
                        resolve();
                    },
                    { once: true },
                );
            });
        });
        const second = fakeClient();
        const lifecycle = new FormaLspLifecycle((runtime) => (runtime.root === "/one" ? first : second));

        const firstSync = lifecycle.sync(context("/one"));
        await vi.waitFor(() => {
            expect(first.start).toHaveBeenCalledOnce();
        });
        const secondSync = lifecycle.sync(context("/two"));
        releaseStart?.();
        await Promise.all([firstSync, secondSync]);

        expect(first.stop).toHaveBeenCalledOnce();
        expect(first.dispose).toHaveBeenCalledOnce();
        expect(second.start).toHaveBeenCalledOnce();
        expect(lifecycle.activeRoot).toBe("/two");
        await lifecycle.disposeAsync();
    });

    it("cleans up a failed client and can recover on the next sync", async () => {
        const failed = fakeClient();
        failed.start.mockRejectedValueOnce(new Error("boom"));
        const recovered = fakeClient();
        let attempt = 0;
        const lifecycle = new FormaLspLifecycle(() => (attempt++ === 0 ? failed : recovered));

        await expect(lifecycle.sync(context("/repo"))).rejects.toThrow("boom");
        expect(failed.stop).toHaveBeenCalledOnce();
        expect(failed.dispose).toHaveBeenCalledOnce();
        expect(lifecycle.state).toBe("failed");
        await lifecycle.sync(context("/repo"));
        expect(recovered.start).toHaveBeenCalledOnce();
        await lifecycle.disposeAsync();
    });

    it("bounds restarts inside a rolling window", () => {
        const budget = new RestartBudget(3, 1_000);
        expect(budget.allow(0)).toBe(true);
        expect(budget.allow(100)).toBe(true);
        expect(budget.allow(200)).toBe(true);
        expect(budget.allow(300)).toBe(false);
        expect(budget.allow(1_101)).toBe(true);
    });
});
