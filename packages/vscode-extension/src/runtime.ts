import { stat } from "node:fs/promises";
import { relative } from "node:path";

import type {
    CheckResult,
    ConfigInspectResult,
    InspectResult,
    ReferenceResolveResult,
    ViewRenderResult,
    WorkspaceDashboardResult,
    WorkspaceHealthResult,
} from "@choral-forma/shared";
import * as vscode from "vscode";

import { FormaClient, resolveFormaCommand, runProcess } from "./forma-client.ts";
import {
    configuredWorkspace,
    discoverWorkspaceRoots,
    selectWorkspaceRoot,
    workspaceRelativePath,
    workspaceScopeFromConfig,
    type WorkspaceScope,
} from "./workspace-discovery.ts";

export type FormaRuntimeState =
    | { kind: "noWorkspace"; label: "Forma: No workspace" }
    | { kind: "restricted"; label: "Forma: Restricted" }
    | { kind: "unsupported"; label: "Forma: Unsupported workspace" }
    | { kind: "checking"; label: "Forma: Checking…" }
    | { kind: "binaryMissing"; label: "Forma: CLI not found"; detail: string }
    | { kind: "configuredWorkspaceMissing"; label: "Forma: Workspace not found"; detail: string }
    | { kind: "incompatible"; label: "Forma: Incompatible version"; detail: string }
    | { kind: "invalidConfig"; label: "Forma: Invalid configuration"; root: string }
    | { kind: "warning"; label: "Forma: Warnings"; root: string }
    | { kind: "failed"; label: "Forma: Failed"; detail: string }
    | { kind: "ready"; label: "Forma: Ready"; root: string };

export class FormaRuntime implements vscode.Disposable {
    private readonly stateEmitter = new vscode.EventEmitter<FormaRuntimeState>();
    private stateValue: FormaRuntimeState = { kind: "noWorkspace", label: "Forma: No workspace" };
    private roots: string[] = [];
    private selectedRoot: string | undefined;
    private client: FormaClient | undefined;
    private refreshController: AbortController | undefined;
    private readonly inspectCache = new Map<string, InspectResult>();
    private readonly scopes = new Map<string, WorkspaceScope>();
    private configTargets: Array<{ base: vscode.Uri; pattern: string }> = [];

    readonly onDidChangeState = this.stateEmitter.event;

    constructor(private readonly output: vscode.OutputChannel) {}

    get state(): FormaRuntimeState {
        return this.stateValue;
    }

    get workspaceRoots(): readonly string[] {
        return this.roots;
    }

    get activeRoot(): string | undefined {
        return "root" in this.stateValue ? this.stateValue.root : (this.selectedRoot ?? this.roots[0]);
    }

    get activeScope(): ({ root: string } & WorkspaceScope) | undefined {
        const root = this.activeRoot;
        const scope = root ? this.scopes.get(root) : undefined;
        return root && scope ? { root, ...scope } : undefined;
    }

    get workspaceConfigTargets(): ReadonlyArray<{ base: vscode.Uri; pattern: string }> {
        return this.configTargets;
    }

    async refresh(activeDocument = vscode.window.activeTextEditor?.document): Promise<void> {
        this.refreshController?.abort();
        this.inspectCache.clear();
        this.configTargets = [];
        const controller = new AbortController();
        this.refreshController = controller;

        const folders = vscode.workspace.workspaceFolders ?? [];
        if (folders.length === 0) {
            this.setState({ kind: "noWorkspace", label: "Forma: No workspace" });
            return;
        }
        if (folders.some((folder) => !["file", "vscode-remote"].includes(folder.uri.scheme))) {
            this.setState({ kind: "unsupported", label: "Forma: Unsupported workspace" });
            return;
        }
        if (!vscode.workspace.isTrusted) {
            this.setState({ kind: "restricted", label: "Forma: Restricted" });
            return;
        }

        this.setState({ kind: "checking", label: "Forma: Checking…" });
        try {
            const configured = folders.map((folder) => ({
                folder,
                workspace: configuredWorkspace(
                    folder.uri.fsPath,
                    vscode.workspace.getConfiguration("forma", folder.uri).get<string>("workspaceConfig", ".forma.md"),
                ),
            }));
            this.configTargets = configured.map(({ folder, workspace }) => ({
                base: folder.uri,
                pattern: workspace.configRelativePath,
            }));
            const discovery = await discoverWorkspaceRoots(
                configured.map(({ workspace }) => workspace),
                async (path) => {
                    try {
                        return (await stat(path)).isFile();
                    } catch {
                        return false;
                    }
                },
            );
            this.roots = discovery.roots;
            for (const root of this.scopes.keys()) {
                if (!this.roots.includes(root)) this.scopes.delete(root);
            }
            if (isAborted(controller)) return;
            if (this.roots.length === 0) {
                const configuredMissing = discovery.missing.find(
                    (workspace) => workspace.configRelativePath !== ".forma.md",
                );
                if (configuredMissing) {
                    this.setState({
                        kind: "configuredWorkspaceMissing",
                        label: "Forma: Workspace not found",
                        detail: `Configured main file not found: ${configuredMissing.configRelativePath}`,
                    });
                } else {
                    this.setState({ kind: "noWorkspace", label: "Forma: No workspace" });
                }
                return;
            }

            const configuration = vscode.workspace.getConfiguration("forma");
            const explicitPath = configuration.inspect<string>("path")?.globalValue;
            const timeoutMs = configuration.get<number>("commandTimeout", 15_000);
            const client = new FormaClient(resolveFormaCommand(explicitPath), runProcess, timeoutMs);
            this.client = client;
            const probe = await client.probe(controller.signal);
            if (isAborted(controller)) return;
            if (probe.kind === "missing") {
                this.setState({ kind: "binaryMissing", label: "Forma: CLI not found", detail: probe.message });
                return;
            }
            if (probe.kind === "incompatible") {
                this.setState({
                    kind: "incompatible",
                    label: "Forma: Incompatible version",
                    detail: `Found ${probe.version}; this extension supports Forma 0.1.0 prereleases.`,
                });
                return;
            }

            const activeRoot =
                this.selectedRoot ?? selectWorkspaceRoot(this.roots, activeDocument?.uri.fsPath) ?? this.roots[0];
            if (!activeRoot) {
                this.setState({ kind: "noWorkspace", label: "Forma: No workspace" });
                return;
            }
            const inspected = await client.configInspect(activeRoot, controller.signal);
            if (isAborted(controller)) return;
            this.scopes.set(activeRoot, workspaceScopeFromConfig(inspected));
            this.logResult(inspected);
            if (inspected.status === "failed") {
                this.setState({ kind: "invalidConfig", label: "Forma: Invalid configuration", root: activeRoot });
            } else if (inspected.status === "warning") {
                this.setState({ kind: "warning", label: "Forma: Warnings", root: activeRoot });
            } else {
                this.setState({ kind: "ready", label: "Forma: Ready", root: activeRoot });
            }
        } catch (error) {
            if (isAborted(controller)) return;
            const detail = safeError(error);
            this.output.appendLine(`[runtime] ${detail}`);
            this.setState({ kind: "failed", label: "Forma: Failed", detail });
        }
    }

    rootForDocument(document: vscode.TextDocument): string | undefined {
        return selectWorkspaceRoot(this.roots, document.uri.fsPath) ?? this.selectedRoot;
    }

    sourcePath(document: vscode.TextDocument): { root: string; path: string } | undefined {
        const source = this.sourceCandidate(document);
        return source && this.isFormaDocument(document) ? source : undefined;
    }

    isFormaDocument(document: vscode.TextDocument): boolean {
        if (document.languageId !== "markdown" || document.isUntitled) return false;
        const source = this.sourceCandidate(document);
        if (!source) return false;
        const scope = this.scopes.get(source.root);
        if (!scope) return false;
        if (scope.configSourcePaths.includes(source.path)) return true;
        return scope.includePatterns.some(
            (pattern) =>
                vscode.languages.match(
                    {
                        language: "markdown",
                        pattern: new vscode.RelativePattern(this.uriFor(source.root), pattern),
                    },
                    document,
                ) > 0,
        );
    }

    isConfigDocument(document: vscode.TextDocument): boolean {
        const source = this.sourceCandidate(document);
        return source ? (this.scopes.get(source.root)?.configSourcePaths.includes(source.path) ?? false) : false;
    }

    invalidateContent(): void {
        this.inspectCache.clear();
    }

    async selectWorkspace(): Promise<void> {
        if (this.roots.length === 0) return;
        const selected = await vscode.window.showQuickPick(
            this.roots.map((root) => ({ label: vscode.workspace.asRelativePath(this.uriFor(root)), root })),
            { placeHolder: "Select the active Forma workspace" },
        );
        if (selected) {
            this.selectedRoot = selected.root;
            await this.refresh();
        }
    }

    async inspectConfiguration(): Promise<ConfigInspectResult | undefined> {
        return await this.withActiveRoot((client, root, signal) => client.configInspect(root, signal));
    }

    async checkWorkspace(): Promise<CheckResult | undefined> {
        return await this.withActiveRoot((client, root, signal) => client.check(root, signal));
    }

    async workspaceHealth(): Promise<WorkspaceHealthResult | undefined> {
        return await this.withActiveRoot((client, root, signal) => client.workspaceHealth(root, signal));
    }

    async workspaceDashboard(): Promise<WorkspaceDashboardResult | undefined> {
        return await this.withActiveRoot((client, root, signal) => client.workspaceDashboard(root, signal));
    }

    async inspectDocument(document: vscode.TextDocument, signal?: AbortSignal): Promise<InspectResult | undefined> {
        const source = this.sourcePath(document);
        if (!source || !this.canExecute() || !this.client) return undefined;
        const cacheKey = `${document.uri.toString()}@${String(document.version)}`;
        const cached = this.inspectCache.get(cacheKey);
        if (cached) return cached;
        const result = await this.client.inspect(source.root, source.path, signal);
        this.inspectCache.set(cacheKey, result);
        while (this.inspectCache.size > 64) {
            const oldest = this.inspectCache.keys().next().value;
            if (!oldest) break;
            this.inspectCache.delete(oldest);
        }
        return result;
    }

    async resolveReference(
        document: vscode.TextDocument,
        target: string,
        intent: "reference" | "link" | "embed",
        fragment?: string,
        signal?: AbortSignal,
    ): Promise<ReferenceResolveResult | undefined> {
        const source = this.sourcePath(document);
        if (!source || !this.canExecute() || !this.client) return undefined;
        return await this.client.resolveReference(source.root, source.path, target, intent, fragment, signal);
    }

    async renderView(document: vscode.TextDocument, signal?: AbortSignal): Promise<ViewRenderResult | undefined> {
        const source = this.sourcePath(document);
        if (!source || !this.canExecute() || !this.client) return undefined;
        return await this.client.renderView(source.root, source.path, signal);
    }

    uriFor(root: string, workspacePath = ""): vscode.Uri {
        const folder = vscode.workspace.workspaceFolders
            ?.filter((candidate) => workspaceRelativePath(candidate.uri.fsPath, root) !== undefined)
            .sort((left, right) => right.uri.fsPath.length - left.uri.fsPath.length)[0];
        if (!folder) return vscode.Uri.file(workspacePath ? `${root}/${workspacePath}` : root);
        const nestedRoot = relative(folder.uri.fsPath, root).split("\\").join("/");
        const segments = [nestedRoot, workspacePath].filter(Boolean).flatMap((part) => part.split("/"));
        return vscode.Uri.joinPath(folder.uri, ...segments);
    }

    logResult(result: unknown): void {
        this.output.appendLine(JSON.stringify(result, undefined, 2).slice(0, 100_000));
    }

    dispose(): void {
        this.refreshController?.abort();
        this.stateEmitter.dispose();
    }

    private canExecute(): boolean {
        return vscode.workspace.isTrusted && ["ready", "warning", "invalidConfig"].includes(this.state.kind);
    }

    private sourceCandidate(document: vscode.TextDocument): { root: string; path: string } | undefined {
        const root = this.rootForDocument(document);
        if (!root) return undefined;
        const path = workspaceRelativePath(root, document.uri.fsPath);
        return path ? { root, path } : undefined;
    }

    private async withActiveRoot<T>(
        operation: (client: FormaClient, root: string, signal: AbortSignal) => Promise<T>,
    ): Promise<T | undefined> {
        if (!this.client || !this.canExecute()) return undefined;
        const root =
            this.selectedRoot ??
            selectWorkspaceRoot(this.roots, vscode.window.activeTextEditor?.document.uri.fsPath) ??
            this.roots[0];
        if (!root) return undefined;
        const controller = new AbortController();
        try {
            const result = await operation(this.client, root, controller.signal);
            this.logResult(result);
            return result;
        } catch (error) {
            this.output.appendLine(`[command] ${safeError(error)}`);
            throw error;
        }
    }

    private setState(state: FormaRuntimeState): void {
        this.stateValue = state;
        this.stateEmitter.fire(state);
    }
}

function isAborted(controller: AbortController): boolean {
    return controller.signal.aborted;
}

function safeError(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).replaceAll(/\s+/gu, " ").slice(0, 2_000);
}
