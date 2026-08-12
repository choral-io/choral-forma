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

const defaultMaxStdoutBytes = 1_048_576;
const largeWorkspaceMaxStdoutBytes = 8_388_608;
const maxStderrBytes = 65_536;

export type ProcessRequest = {
    command: string;
    args: string[];
    cwd?: string;
    signal?: AbortSignal;
    timeoutMs: number;
    maxStdoutBytes: number;
    maxStderrBytes: number;
};

export type ProcessResult = {
    code: number | null;
    stdout: string;
    stderr: string;
};

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

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
        const stdout = { chunks: [] as Buffer[], byteLength: 0 };
        const stderr = { chunks: [] as Buffer[], byteLength: 0 };
        let timedOut = false;
        let outputExceeded = false;

        const append = (output: typeof stdout, chunk: Buffer, maximumBytes: number): void => {
            if (outputExceeded) return;
            const remainingBytes = maximumBytes - output.byteLength;
            if (chunk.byteLength > remainingBytes) {
                if (remainingBytes > 0) {
                    output.chunks.push(chunk.subarray(0, remainingBytes));
                    output.byteLength += remainingBytes;
                }
                outputExceeded = true;
                child.kill();
                return;
            }
            output.chunks.push(chunk);
            output.byteLength += chunk.byteLength;
        };
        child.stdout.on("data", (chunk: Buffer) => {
            append(stdout, chunk, request.maxStdoutBytes);
        });
        child.stderr.on("data", (chunk: Buffer) => {
            append(stderr, chunk, request.maxStderrBytes);
        });

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
            const stdoutText = Buffer.concat(stdout.chunks, stdout.byteLength).toString("utf8");
            const stderrText = Buffer.concat(stderr.chunks, stderr.byteLength).toString("utf8");
            if (request.signal?.aborted) {
                reject(new FormaCommandError("Forma command was cancelled.", "cancelled", boundedMessage(stderrText)));
                return;
            }
            if (timedOut) {
                reject(new FormaCommandError("Forma command timed out.", "timeout", boundedMessage(stderrText)));
                return;
            }
            if (outputExceeded) {
                reject(
                    new FormaCommandError(
                        "Forma command output exceeded the safe limit.",
                        "failed",
                        boundedMessage(stderrText),
                    ),
                );
                return;
            }
            resolve({ code, stdout: stdoutText, stderr: stderrText });
        });
    });

export class FormaClient {
    private readonly scheduler: RequestScheduler<ProcessResult>;

    constructor(
        private readonly command: string,
        private readonly runner: ProcessRunner = runProcess,
        private readonly timeoutMs = 15_000,
        concurrency = 2,
    ) {
        this.scheduler = new RequestScheduler(concurrency);
    }

    invalidate(): void {
        this.scheduler.invalidate();
    }

    configInspect(workspace: string, signal?: AbortSignal): Promise<ConfigInspectResult> {
        return this.runJson("config.inspect", workspace, ["config", "inspect"], signal);
    }

    check(workspace: string, signal?: AbortSignal): Promise<CheckResult> {
        return this.runJson("check", workspace, ["check"], signal, largeWorkspaceMaxStdoutBytes);
    }

    workspaceHealth(workspace: string, signal?: AbortSignal): Promise<WorkspaceHealthResult> {
        return this.runJson(
            "workspace.health",
            workspace,
            ["workspace", "health"],
            signal,
            largeWorkspaceMaxStdoutBytes,
        );
    }

    workspaceDashboard(workspace: string, signal?: AbortSignal): Promise<WorkspaceDashboardResult> {
        return this.runJson(
            "workspace.dashboard",
            workspace,
            ["workspace", "dashboard"],
            signal,
            largeWorkspaceMaxStdoutBytes,
        );
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
        return this.runJson("view.render", workspace, ["view", "render", view], signal, largeWorkspaceMaxStdoutBytes);
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
        maxStdoutBytes = defaultMaxStdoutBytes,
    ): Promise<T> {
        const result = await this.run({
            command: this.command,
            args: ["--workspace", workspace, ...args, "--json"],
            cwd: workspace,
            timeoutMs: this.timeoutMs,
            maxStdoutBytes,
            maxStderrBytes,
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
            throw new FormaCommandError(
                `Forma ${operation} returned invalid JSON.`,
                "invalidJson",
                boundedMessage(result.stderr),
            );
        }
        if (
            !isOperationResult(value) ||
            value.schemaVersion !== supportedSchemaVersion ||
            value.operation !== operation
        ) {
            throw new FormaCommandError(
                `Forma ${operation} returned an incompatible operation schema.`,
                "incompatibleSchema",
                boundedMessage(result.stderr),
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
            scheduled.maxStdoutBytes,
            scheduled.maxStderrBytes,
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

export function formatFormaError(error: unknown): string {
    if (error instanceof FormaCommandError && error.stderr) {
        return `${error.message} CLI stderr: ${error.stderr}`.replaceAll(/\s+/gu, " ").slice(0, 2_000);
    }
    return (error instanceof Error ? error.message : String(error)).replaceAll(/\s+/gu, " ").slice(0, 2_000);
}

export function isFormaExecutableUnavailable(error: unknown): boolean {
    if (!(error instanceof Error) || !("code" in error)) return false;
    const code = error.code;
    return code === "ENOENT" || code === "EACCES";
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
