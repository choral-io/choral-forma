import { describe, expect, it, vi } from "vitest";

import {
    FormaClient,
    FormaCommandError,
    formatFormaError,
    isFormaExecutableUnavailable,
    resolveFormaCommand,
    runProcess,
    type ProcessRunner,
} from "./forma-client.ts";

function runner(result: { code: number; stdout: string; stderr?: string }): ProcessRunner {
    return vi.fn(async () => ({ code: result.code, stdout: result.stdout, stderr: result.stderr ?? "" }));
}

describe("resolveFormaCommand", () => {
    it("prefers an explicit user path and otherwise uses PATH", () => {
        expect(resolveFormaCommand(" /opt/forma/bin/forma ")).toBe("/opt/forma/bin/forma");
        expect(resolveFormaCommand(" ")).toBe("forma");
        expect(resolveFormaCommand(undefined)).toBe("forma");
        expect(() => resolveFormaCommand("./workspace/forma")).toThrow("must be an absolute path");
    });
});

describe("FormaClient", () => {
    it("uses a larger bounded stdout budget only for full workspace results", async () => {
        const requests: Parameters<ProcessRunner>[0][] = [];
        const fake: ProcessRunner = vi.fn(async (request: Parameters<ProcessRunner>[0]) => {
            requests.push(request);
            const command = request.args.slice(2, -1).join(" ");
            const operation = command.startsWith("config inspect")
                ? "config.inspect"
                : command.startsWith("workspace explorer-entries")
                  ? "workspace.explorerEntries"
                  : command.startsWith("workspace explorer")
                    ? "workspace.explorer"
                    : command.startsWith("workspace dashboard")
                      ? "workspace.dashboard"
                      : command.startsWith("workspace health")
                        ? "workspace.health"
                        : command.startsWith("inspect")
                          ? "inspect"
                          : command.startsWith("view render")
                            ? "view.render"
                            : command.startsWith("reference resolve")
                              ? "reference.resolve"
                              : "check";
            return { code: 0, stderr: "", stdout: JSON.stringify({ schemaVersion: 1, operation, status: "passed" }) };
        });
        const client = new FormaClient("forma", fake);

        await client.configInspect("/workspace");
        await client.check("/workspace");
        await client.workspaceHealth("/workspace");
        await client.workspaceDashboard("/workspace");
        await client.workspaceExplorer("/workspace");
        await client.workspaceExplorerEntries("/workspace", "spaces", "notes");
        await client.inspect("/workspace", "notes/a.md");
        await client.renderView("/workspace", ".forma/views/graph.md");
        await client.resolveReference("/workspace", "notes/a.md", "notes/b", "link");

        expect(requests.map(({ maxStdoutBytes, maxStderrBytes }) => ({ maxStdoutBytes, maxStderrBytes }))).toEqual(
            [1_048_576, 8_388_608, 8_388_608, 8_388_608, 1_048_576, 1_048_576, 1_048_576, 8_388_608, 1_048_576].map(
                (maxStdoutBytes) => ({ maxStdoutBytes, maxStderrBytes: 65_536 }),
            ),
        );
    });

    it("validates JSON operation identity", async () => {
        const client = new FormaClient(
            "forma",
            runner({ code: 0, stdout: JSON.stringify({ schemaVersion: 1, operation: "check", status: "passed" }) }),
        );
        await expect(client.check("/workspace")).resolves.toMatchObject({ operation: "check" });
    });

    it("deduplicates identical in-flight operations", async () => {
        const fake: ProcessRunner = vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return {
                code: 0,
                stderr: "",
                stdout: JSON.stringify({ schemaVersion: 1, operation: "check", status: "passed" }),
            };
        });
        const client = new FormaClient("forma", fake);

        await Promise.all(Array.from({ length: 10 }, () => client.check("/workspace")));
        expect(fake).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid JSON and unknown schemas", async () => {
        await expect(
            new FormaClient("forma", runner({ code: 0, stdout: "not-json" })).check("/workspace"),
        ).rejects.toMatchObject({
            kind: "invalidJson",
        });
        await expect(
            new FormaClient(
                "forma",
                runner({ code: 0, stdout: JSON.stringify({ schemaVersion: 2, operation: "check", status: "passed" }) }),
            ).check("/workspace"),
        ).rejects.toBeInstanceOf(FormaCommandError);
    });

    it("reports non-zero exits, timeouts, and cancellation", async () => {
        await expect(
            new FormaClient("forma", runner({ code: 2, stdout: "", stderr: "bounded failure" })).check("/workspace"),
        ).rejects.toMatchObject({ kind: "failed", stderr: "bounded failure" });

        for (const kind of ["timeout", "cancelled"] as const) {
            const failing: ProcessRunner = vi.fn(async () => {
                throw new FormaCommandError(kind, kind);
            });
            await expect(new FormaClient("forma", failing).check("/workspace")).rejects.toMatchObject({ kind });
        }
    });

    it("recognizes executable launch failures without a version probe", () => {
        expect(isFormaExecutableUnavailable(Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }))).toBe(true);
        expect(isFormaExecutableUnavailable(Object.assign(new Error("spawn EACCES"), { code: "EACCES" }))).toBe(true);
        expect(isFormaExecutableUnavailable(new FormaCommandError("invalid JSON", "invalidJson"))).toBe(false);
        expect(isFormaExecutableUnavailable(new Error("other failure"))).toBe(false);
    });

    it("formats bounded CLI stderr for command diagnostics", () => {
        const error = new FormaCommandError(
            "Forma workspace.explorer failed with exit code 2.",
            "failed",
            `unknown command\n${"x".repeat(2_500)}`,
        );

        const diagnostic = formatFormaError(error);
        expect(diagnostic).toContain("Forma workspace.explorer failed with exit code 2.");
        expect(diagnostic).toContain("CLI stderr: unknown command");
        expect(diagnostic).not.toContain("\n");
        expect(diagnostic.length).toBeLessThanOrEqual(2_000);
    });

    it("passes workspace and structured JSON arguments without logging the environment", async () => {
        const fake = runner({
            code: 0,
            stdout: JSON.stringify({ schemaVersion: 1, operation: "check", status: "passed" }),
        });
        await new FormaClient("/bin/forma", fake).check("/workspace");
        expect(fake).toHaveBeenCalledWith(
            expect.objectContaining({
                command: "/bin/forma",
                args: ["--workspace", "/workspace", "check", "--json"],
                cwd: "/workspace",
            }),
        );
    });

    it("exposes config, Explorer, health, inspect, view, and reference operations through one typed boundary", async () => {
        const fake: ProcessRunner = vi.fn(async (request) => {
            const command = request.args.slice(2, -1).join(" ");
            const operation = command.startsWith("config inspect")
                ? "config.inspect"
                : command.startsWith("workspace explorer-entries")
                  ? "workspace.explorerEntries"
                  : command.startsWith("workspace explorer")
                    ? "workspace.explorer"
                    : command.startsWith("workspace dashboard")
                      ? "workspace.dashboard"
                      : command.startsWith("workspace health")
                        ? "workspace.health"
                        : command.startsWith("inspect")
                          ? "inspect"
                          : command.startsWith("view render")
                            ? "view.render"
                            : "reference.resolve";
            return { code: 0, stderr: "", stdout: JSON.stringify({ schemaVersion: 1, operation, status: "passed" }) };
        });
        const client = new FormaClient("forma", fake);
        await client.configInspect("/workspace");
        await client.workspaceDashboard("/workspace");
        await client.workspaceExplorer("/workspace");
        await client.workspaceExplorerEntries("/workspace", "spaces", "notes", "100", 100);
        await client.workspaceHealth("/workspace");
        await client.inspect("/workspace", "notes/a.md");
        await client.renderView("/workspace", ".forma/views/a.md");
        await client.resolveReference("/workspace", "notes/a.md", "notes/b", "link");
        expect(fake).toHaveBeenCalledTimes(8);
        expect(fake).toHaveBeenCalledWith(
            expect.objectContaining({
                args: [
                    "--workspace",
                    "/workspace",
                    "workspace",
                    "explorer-entries",
                    "--taxonomy",
                    "spaces",
                    "--term",
                    "notes",
                    "--limit",
                    "100",
                    "--cursor",
                    "100",
                    "--json",
                ],
            }),
        );
    });
});

describe("runProcess", () => {
    it("accepts the observed graph payload within the view-render budget", async () => {
        await expect(
            runProcess({
                command: process.execPath,
                args: ["-e", 'process.stdout.write("x".repeat(2_314_372))'],
                timeoutMs: 15_000,
                maxStdoutBytes: 8_388_608,
                maxStderrBytes: 65_536,
            }),
        ).resolves.toMatchObject({ code: 0 });
    });

    it("enforces stdout and stderr budgets independently", async () => {
        await expect(
            runProcess({
                command: process.execPath,
                args: ["-e", 'process.stdout.write("x".repeat(33))'],
                timeoutMs: 15_000,
                maxStdoutBytes: 32,
                maxStderrBytes: 64,
            }),
        ).rejects.toMatchObject({ kind: "failed" });

        await expect(
            runProcess({
                command: process.execPath,
                args: ["-e", 'process.stdout.write("x".repeat(64)); process.stderr.write("y".repeat(33))'],
                timeoutMs: 15_000,
                maxStdoutBytes: 64,
                maxStderrBytes: 32,
            }),
        ).rejects.toMatchObject({ kind: "failed" });
    });
});
