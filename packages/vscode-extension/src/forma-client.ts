import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";

import type {
    BaseOperationResult,
    CheckResult,
    ConfigInspectResult,
    InspectResult,
    ReferenceResolveResult,
    ViewRenderResult,
    WorkspaceDashboardResult,
    WorkspaceExplorerEntriesResult,
    WorkspaceExplorerResult,
    WorkspaceHealthResult,
} from "@choral-forma/shared";

import { RequestScheduler } from "./request-scheduler.ts";

export const supportedSchemaVersion = 1;
export const supportedFormaVersion = /^0\.1\.0(?:-|$)/u;

export type ProcessRequest = {
    command: string;
    args: string[];
    cwd?: string;
    signal?: AbortSignal;
    timeoutMs: number;
    maxOutputBytes: number;
};

export type ProcessResult = {
    code: number | null;
    stdout: string;
    stderr: string;
};

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

export type FormaProbe =
    | { kind: "ready"; command: string; version: string }
    | { kind: "missing"; command: string; message: string }
    | { kind: "incompatible"; command: string; version: string };

export class FormaCommandError extends Error {
    constructor(
        message: string,
        readonly kind: "cancelled" | "timeout" | "failed" | "invalidJson" | "incompatibleSchema",
        readonly stderr = "",
    ) {
        super(message);
        this.name = "FormaCommandError";
    }
}

export const runProcess: ProcessRunner = async (request) =>
    await new Promise<ProcessResult>((resolve, reject) => {
        if (request.signal?.aborted) {
            reject(new FormaCommandError("Forma command was cancelled.", "cancelled"));
            return;
        }
        const child = spawn(request.command, request.args, {
            cwd: request.cwd,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let outputExceeded = false;

        const append = (current: string, chunk: Buffer): string => {
            const next = current + chunk.toString("utf8");
            if (Buffer.byteLength(next) > request.maxOutputBytes) {
                outputExceeded = true;
                child.kill();
                return next.slice(0, request.maxOutputBytes);
            }
            return next;
        };
        child.stdout.on("data", (chunk: Buffer) => (stdout = append(stdout, chunk)));
        child.stderr.on("data", (chunk: Buffer) => (stderr = append(stderr, chunk)));

        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill();
        }, request.timeoutMs);
        const cancel = (): void => {
            child.kill();
        };
        request.signal?.addEventListener("abort", cancel, { once: true });

        child.once("error", (error) => {
            clearTimeout(timeout);
            request.signal?.removeEventListener("abort", cancel);
            reject(error);
        });
        child.once("close", (code) => {
            clearTimeout(timeout);
            request.signal?.removeEventListener("abort", cancel);
            if (request.signal?.aborted) {
                reject(new FormaCommandError("Forma command was cancelled.", "cancelled"));
                return;
            }
            if (timedOut) {
                reject(new FormaCommandError("Forma command timed out.", "timeout"));
                return;
            }
            if (outputExceeded) {
                reject(new FormaCommandError("Forma command output exceeded the safe limit.", "failed"));
                return;
            }
            resolve({ code, stdout, stderr });
        });
    });

export class FormaClient {
    private readonly scheduler: RequestScheduler<ProcessResult>;

    constructor(
        private readonly command: string,
        private readonly runner: ProcessRunner = runProcess,
        private readonly timeoutMs = 15_000,
        private readonly maxOutputBytes = 1_048_576,
        concurrency = 2,
    ) {
        this.scheduler = new RequestScheduler(concurrency);
    }

    invalidate(): void {
        this.scheduler.invalidate();
    }

    async probe(signal?: AbortSignal): Promise<FormaProbe> {
        try {
            const result = await this.run({
                command: this.command,
                args: ["--version"],
                timeoutMs: this.timeoutMs,
                maxOutputBytes: 8_192,
                ...(signal ? { signal } : {}),
            });
            if (result.code !== 0) {
                return { kind: "missing", command: this.command, message: boundedMessage(result.stderr) };
            }
            const match = /^forma\s+([^\s]+)$/u.exec(result.stdout.trim());
            if (!match?.[1] || !supportedFormaVersion.test(match[1])) {
                return { kind: "incompatible", command: this.command, version: match?.[1] ?? "unknown" };
            }
            return { kind: "ready", command: this.command, version: match[1] };
        } catch (error) {
            return {
                kind: "missing",
                command: this.command,
                message: error instanceof Error ? error.message : "Forma could not be started.",
            };
        }
    }

    configInspect(workspace: string, signal?: AbortSignal): Promise<ConfigInspectResult> {
        return this.runJson("config.inspect", workspace, ["config", "inspect"], signal);
    }

    check(workspace: string, signal?: AbortSignal): Promise<CheckResult> {
        return this.runJson("check", workspace, ["check"], signal);
    }

    workspaceHealth(workspace: string, signal?: AbortSignal): Promise<WorkspaceHealthResult> {
        return this.runJson("workspace.health", workspace, ["workspace", "health"], signal);
    }

    workspaceDashboard(workspace: string, signal?: AbortSignal): Promise<WorkspaceDashboardResult> {
        return this.runJson("workspace.dashboard", workspace, ["workspace", "dashboard"], signal);
    }

    workspaceExplorer(workspace: string, signal?: AbortSignal): Promise<WorkspaceExplorerResult> {
        return this.runJson("workspace.explorer", workspace, ["workspace", "explorer"], signal);
    }

    workspaceExplorerEntries(
        workspace: string,
        taxonomyId: string,
        termId: string,
        cursor?: string,
        limit = 100,
        signal?: AbortSignal,
    ): Promise<WorkspaceExplorerEntriesResult> {
        const args = [
            "workspace",
            "explorer-entries",
            "--taxonomy",
            taxonomyId,
            "--term",
            termId,
            "--limit",
            String(limit),
        ];
        if (cursor) args.push("--cursor", cursor);
        return this.runJson("workspace.explorerEntries", workspace, args, signal);
    }

    inspect(workspace: string, path: string, signal?: AbortSignal): Promise<InspectResult> {
        return this.runJson("inspect", workspace, ["inspect", path], signal);
    }

    renderView(workspace: string, view: string, signal?: AbortSignal): Promise<ViewRenderResult> {
        return this.runJson("view.render", workspace, ["view", "render", view], signal);
    }

    resolveReference(
        workspace: string,
        sourcePath: string,
        target: string,
        intent: "reference" | "link" | "embed",
        fragment?: string,
        signal?: AbortSignal,
    ): Promise<ReferenceResolveResult> {
        const args = ["reference", "resolve", "--source", sourcePath, "--target", target, "--intent", intent];
        if (fragment) args.push("--fragment", fragment);
        return this.runJson("reference.resolve", workspace, args, signal);
    }

    private async runJson<T extends BaseOperationResult>(
        operation: T["operation"],
        workspace: string,
        args: string[],
        signal?: AbortSignal,
    ): Promise<T> {
        const result = await this.run({
            command: this.command,
            args: ["--workspace", workspace, ...args, "--json"],
            cwd: workspace,
            timeoutMs: this.timeoutMs,
            maxOutputBytes: this.maxOutputBytes,
            ...(signal ? { signal } : {}),
        });
        if (result.code !== 0 && result.stdout.trim() === "") {
            throw new FormaCommandError(
                `Forma ${operation} failed with exit code ${String(result.code)}.`,
                "failed",
                boundedMessage(result.stderr),
            );
        }
        let value: unknown;
        try {
            value = JSON.parse(result.stdout);
        } catch {
            throw new FormaCommandError(`Forma ${operation} returned invalid JSON.`, "invalidJson");
        }
        if (
            !isOperationResult(value) ||
            value.schemaVersion !== supportedSchemaVersion ||
            value.operation !== operation
        ) {
            throw new FormaCommandError(
                `Forma ${operation} returned an incompatible operation schema.`,
                "incompatibleSchema",
            );
        }
        return value as T;
    }

    private run(request: ProcessRequest): Promise<ProcessResult> {
        const { signal, ...scheduled } = request;
        const key = JSON.stringify([
            scheduled.command,
            scheduled.args,
            scheduled.cwd,
            scheduled.timeoutMs,
            scheduled.maxOutputBytes,
        ]);
        return this.scheduler.schedule(
            key,
            async (scheduledSignal) => await this.runner({ ...scheduled, signal: scheduledSignal }),
            signal,
        );
    }
}

export function resolveFormaCommand(explicitUserPath: string | undefined): string {
    const configured = explicitUserPath?.trim();
    if (!configured) return "forma";
    if (!isAbsolute(configured)) {
        throw new Error("The user-level forma.path setting must be an absolute path.");
    }
    return configured;
}

function isOperationResult(value: unknown): value is { schemaVersion: number; operation: string } {
    return (
        typeof value === "object" &&
        value !== null &&
        "schemaVersion" in value &&
        "operation" in value &&
        typeof value.schemaVersion === "number" &&
        typeof value.operation === "string"
    );
}

function boundedMessage(message: string): string {
    const normalized = message.trim().replaceAll(/\s+/gu, " ");
    return normalized.slice(0, 1_000);
}
