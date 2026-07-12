import { describe, expect, it, vi } from "vitest";

import { FormaClient, FormaCommandError, resolveFormaCommand, type ProcessRunner } from "./forma-client.ts";

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
    it("probes compatible and incompatible versions", async () => {
        await expect(
            new FormaClient("forma", runner({ code: 0, stdout: "forma 0.1.0-alpha.1\n" })).probe(),
        ).resolves.toMatchObject({
            kind: "ready",
        });
        await expect(new FormaClient("forma", runner({ code: 0, stdout: "forma 0.2.0\n" })).probe()).resolves.toEqual({
            kind: "incompatible",
            command: "forma",
            version: "0.2.0",
        });
    });

    it("validates JSON operation identity", async () => {
        const client = new FormaClient(
            "forma",
            runner({ code: 0, stdout: JSON.stringify({ schemaVersion: 1, operation: "check", status: "passed" }) }),
        );
        await expect(client.check("/workspace")).resolves.toMatchObject({ operation: "check" });
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

    it("reports missing binaries, non-zero exits, timeouts, and cancellation", async () => {
        const missing: ProcessRunner = vi.fn(async () => {
            throw new Error("spawn ENOENT");
        });
        await expect(new FormaClient("forma", missing).probe()).resolves.toMatchObject({ kind: "missing" });

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

    it("exposes config, dashboard, health, inspect, view, and reference operations through one typed boundary", async () => {
        const fake: ProcessRunner = vi.fn(async (request) => {
            const command = request.args.slice(2, -1).join(" ");
            const operation = command.startsWith("config inspect")
                ? "config.inspect"
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
        await client.workspaceHealth("/workspace");
        await client.inspect("/workspace", "notes/a.md");
        await client.renderView("/workspace", ".forma/views/a.md");
        await client.resolveReference("/workspace", "notes/a.md", "notes/b", "link");
        expect(fake).toHaveBeenCalledTimes(6);
    });
});
