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

    it("keeps at most one active client while selecting among one, two, and five roots", async () => {
        let activeClients = 0;
        let maximumActiveClients = 0;
        const startedRoots: string[] = [];
        const lifecycle = new FormaLspLifecycle((runtime) => ({
            start: async () => {
                activeClients += 1;
                maximumActiveClients = Math.max(maximumActiveClients, activeClients);
                startedRoots.push(runtime.root);
            },
            stop: async () => {
                activeClients -= 1;
            },
            dispose: async () => undefined,
        }));

        for (const root of ["/one", "/two", "/three", "/four", "/five"]) {
            await lifecycle.sync(context(root));
            expect(lifecycle.activeRoot).toBe(root);
            expect(activeClients).toBe(1);
        }
        expect(startedRoots).toEqual(["/one", "/two", "/three", "/four", "/five"]);
        expect(maximumActiveClients).toBe(1);

        await lifecycle.stop();
        expect(activeClients).toBe(0);
        expect(lifecycle.state).toBe("stopped");
    });

    it("restarts when the managed scope changes and stops when the workspace root is removed", async () => {
        const calls: string[] = [];
        const lifecycle = new FormaLspLifecycle((runtime) => ({
            start: async () => {
                calls.push(`start:${runtime.includePatterns.join(",")}`);
            },
            stop: async () => {
                calls.push("stop");
            },
            dispose: async () => {
                calls.push("dispose");
            },
        }));
        const initial = context("/repo");
        const changed = { ...initial, includePatterns: ["tasks/**/*.md"] };

        await lifecycle.sync(initial);
        await lifecycle.sync(changed);
        await lifecycle.sync(undefined);

        expect(calls).toEqual([
            "start:notes/**/*.md,notes/**/*.md",
            "stop",
            "dispose",
            "start:tasks/**/*.md",
            "stop",
            "dispose",
        ]);
        expect(lifecycle.activeRoot).toBeUndefined();
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

    it("replaces a same-root client after its bounded transport recovery stops", async () => {
        let firstRunning = true;
        const first = fakeClient();
        first.isRunning = () => firstRunning;
        const recovered = fakeClient();
        recovered.isRunning = () => true;
        let attempt = 0;
        const lifecycle = new FormaLspLifecycle(() => (attempt++ === 0 ? first : recovered));

        await lifecycle.sync(context("/repo"));
        firstRunning = false;
        expect(lifecycle.state).toBe("failed");
        await lifecycle.sync(context("/repo"));

        expect(first.stop).toHaveBeenCalledOnce();
        expect(first.dispose).toHaveBeenCalledOnce();
        expect(recovered.start).toHaveBeenCalledOnce();
        expect(lifecycle.state).toBe("running");
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
