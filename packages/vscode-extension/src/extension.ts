import * as vscode from "vscode";

import { installManagedCli } from "./managed-cli.ts";
import { extendMarkdownIt, type MarkdownIt } from "./markdown-enhancer.ts";
import { NativePreviewManager } from "./native-preview.ts";
import { registerNavigation } from "./navigation.ts";
import { openSource } from "./preview.ts";
import { FormaRuntime } from "./runtime.ts";
import { statusText } from "./status-presentation.ts";
import { shouldRefreshRuntimeForDocument } from "./workspace-discovery.ts";
import { FormaWorkspaceExplorer } from "./workspace-tree.ts";

export async function activate(
    context: vscode.ExtensionContext,
): Promise<{ extendMarkdownIt: typeof extendMarkdownIt }> {
    const output = vscode.window.createOutputChannel("Forma", { log: true });
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
    const diagnostics = vscode.languages.createDiagnosticCollection("forma");
    const expectedCliVersion = extensionVersion(context.extension.packageJSON as unknown);
    const runtime = new FormaRuntime(output, expectedCliVersion, context.globalStorageUri);
    const previews = new NativePreviewManager(runtime);
    const explorer = new FormaWorkspaceExplorer(runtime, context);
    let workspaceWatchers: vscode.Disposable[] = [];
    let contentRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    let configRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    let offeredCliRecovery = false;

    const disposeWorkspaceWatchers = (): void => {
        for (const disposable of workspaceWatchers) disposable.dispose();
        workspaceWatchers = [];
    };
    const scheduleContentRefresh = (): void => {
        runtime.invalidateContent();
        if (contentRefreshTimer) clearTimeout(contentRefreshTimer);
        contentRefreshTimer = setTimeout(() => {
            contentRefreshTimer = undefined;
            void explorer.refresh();
        }, 100);
    };
    const scheduleConfigRefresh = (): void => {
        if (configRefreshTimer) clearTimeout(configRefreshTimer);
        configRefreshTimer = setTimeout(() => {
            configRefreshTimer = undefined;
            void runtime.refresh();
        }, 100);
    };
    const resetWorkspaceWatchers = (): void => {
        disposeWorkspaceWatchers();
        const targets = new Map<string, { base: vscode.Uri; pattern: string; config: boolean }>();
        for (const target of runtime.workspaceConfigTargets) {
            const key = watcherKey(target.base, target.pattern);
            targets.set(key, { ...target, config: true });
        }
        const scope = runtime.activeScope;
        if (scope) {
            const base = runtime.uriFor(scope.root);
            for (const pattern of scope.configSourcePaths) {
                targets.set(watcherKey(base, pattern), { base, pattern, config: true });
            }
            for (const pattern of scope.configPatterns) {
                targets.set(watcherKey(base, pattern), { base, pattern, config: true });
            }
            for (const pattern of scope.includePatterns) {
                const key = watcherKey(base, pattern);
                if (!targets.has(key)) targets.set(key, { base, pattern, config: false });
            }
        }
        for (const target of targets.values()) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(target.base, target.pattern),
            );
            const onChange = target.config ? scheduleConfigRefresh : scheduleContentRefresh;
            workspaceWatchers.push(
                watcher,
                watcher.onDidCreate(onChange),
                watcher.onDidChange(onChange),
                watcher.onDidDelete(onChange),
            );
        }
    };
    status.command = "forma.statusMenu";
    status.name = "Forma";
    status.show();

    const updateStatus = (): void => {
        status.text = statusText(runtime.state);
        status.tooltip = stateTooltip(runtime.state);
        status.accessibilityInformation = { label: runtime.state.label };
    };
    context.subscriptions.push(
        output,
        status,
        diagnostics,
        runtime,
        previews,
        {
            dispose: () => {
                disposeWorkspaceWatchers();
                if (contentRefreshTimer) clearTimeout(contentRefreshTimer);
                if (configRefreshTimer) clearTimeout(configRefreshTimer);
            },
        },
        runtime.onDidChangeState(() => {
            updateStatus();
            if (runtime.state.kind !== "checking") {
                resetWorkspaceWatchers();
                void explorer.refresh();
            }
            if (
                !offeredCliRecovery &&
                (runtime.state.kind === "binaryMissing" || runtime.state.kind === "incompatible")
            ) {
                offeredCliRecovery = true;
                void offerCliRecovery(runtime.state);
            }
        }),
    );
    updateStatus();

    context.subscriptions.push(
        vscode.commands.registerCommand("forma.statusMenu", async () => {
            const cliRecovery = ["binaryMissing", "incompatible"].includes(runtime.state.kind)
                ? [{ label: "$(cloud-download) Install Matching Forma CLI", command: "forma.installCli" }]
                : [];
            const choice = await vscode.window.showQuickPick(
                [
                    ...cliRecovery,
                    { label: "$(file-binary) Choose Existing Forma CLI", command: "forma.selectCli" },
                    { label: "$(book) Open CLI Installation Instructions", command: "forma.openCliInstructions" },
                    { label: "$(root-folder) Select Workspace", command: "forma.selectWorkspace" },
                    { label: "$(inspect) Inspect Configuration", command: "forma.inspectConfiguration" },
                    { label: "$(check-all) Check Workspace", command: "forma.checkWorkspace" },
                    { label: "$(refresh) Refresh Workspace", command: "forma.refreshWorkspace" },
                    { label: "$(output) Open Output", command: "forma.openOutput" },
                ],
                { placeHolder: runtime.state.label },
            );
            if (choice) await vscode.commands.executeCommand(choice.command);
        }),
        vscode.commands.registerCommand("forma.selectWorkspace", async () => {
            await runtime.selectWorkspace();
        }),
        vscode.commands.registerCommand("forma.inspectConfiguration", async () => {
            const result = await runtime.inspectConfiguration();
            if (result) runtime.logResult(result);
            output.show(true);
        }),
        vscode.commands.registerCommand("forma.checkWorkspace", async () => {
            const result = await runtime.checkWorkspace();
            if (result) {
                runtime.logResult(result);
                void vscode.window.showInformationMessage(`Forma check: ${result.status}`);
            }
        }),
        vscode.commands.registerCommand("forma.refreshWorkspace", async () => {
            await runtime.refresh();
            const document = vscode.window.activeTextEditor?.document;
            if (document && runtime.isFormaDocument(document)) await previews.refresh(document);
        }),
        vscode.commands.registerCommand("forma.refreshExplorer", async () => {
            await explorer.refresh();
        }),
        vscode.commands.registerCommand("forma.openOutput", () => {
            output.show(true);
        }),
        vscode.commands.registerCommand("forma.installCli", async () => {
            await installMatchingCli(context, runtime, expectedCliVersion, output);
        }),
        vscode.commands.registerCommand("forma.selectCli", async () => {
            await selectExistingCli(runtime);
        }),
        vscode.commands.registerCommand("forma.openCliInstructions", async () => {
            await vscode.env.openExternal(
                vscode.Uri.parse("https://github.com/choral-io/choral-forma#installing-forma"),
            );
        }),
        vscode.commands.registerCommand("forma.getRuntimeState", () => runtime.state),
        vscode.commands.registerCommand("forma.openViewPreview", async (uri?: vscode.Uri) => {
            const document = await targetDocument(uri);
            if (document) await previews.open(document, false);
        }),
        vscode.commands.registerCommand("forma.openViewPreviewToSide", async (uri?: vscode.Uri) => {
            const document = await targetDocument(uri);
            if (document) await previews.open(document, true);
        }),
        vscode.commands.registerCommand("forma.openSource", async (uri?: vscode.Uri) => {
            if (uri) await openSource(uri);
        }),
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (runtime.isFormaDocument(document)) await previews.refresh(document);
            if (runtime.isConfigDocument(document)) scheduleConfigRefresh();
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => void runtime.refresh()),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            void (async () => {
                const documentRoot = editor ? runtime.rootForDocument(editor.document) : undefined;
                if (
                    editor &&
                    shouldRefreshRuntimeForDocument(runtime.workspaceRoots.length, runtime.activeRoot, documentRoot)
                ) {
                    await runtime.refresh(editor.document);
                }
                if (editor && runtime.isFormaDocument(editor.document)) await previews.refresh(editor.document);
            })();
        }),
        vscode.workspace.onDidGrantWorkspaceTrust(() => void runtime.refresh()),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration("forma")) void runtime.refresh();
        }),
    );

    registerNavigation(context, runtime, diagnostics);
    await runtime.refresh();
    const document = vscode.window.activeTextEditor?.document;
    if (document && runtime.isFormaDocument(document)) await previews.refresh(document);
    return { extendMarkdownIt };
}

export { extendMarkdownIt };
export type { MarkdownIt };

async function targetDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
    if (uri) return await vscode.workspace.openTextDocument(uri);
    return vscode.window.activeTextEditor?.document;
}

function stateTooltip(state: FormaRuntime["state"]): string {
    if ("detail" in state) return `${state.label}\n${state.detail}`;
    if ("root" in state) return `${state.label}\n${state.root}`;
    return state.label;
}

function watcherKey(base: vscode.Uri, pattern: string): string {
    if (
        pattern.includes("*") ||
        pattern.includes("?") ||
        pattern.includes("[") ||
        pattern.includes("]") ||
        pattern.includes("{") ||
        pattern.includes("}")
    ) {
        return `${base.toString()}\0${pattern}`;
    }
    return vscode.Uri.joinPath(base, ...pattern.split("/")).toString();
}

function extensionVersion(packageJSON: unknown): string {
    if (
        typeof packageJSON !== "object" ||
        packageJSON === null ||
        !("version" in packageJSON) ||
        typeof packageJSON.version !== "string"
    ) {
        throw new Error("Forma extension manifest does not declare a valid version.");
    }
    return packageJSON.version;
}

async function offerCliRecovery(
    state: Extract<FormaRuntime["state"], { kind: "binaryMissing" | "incompatible" }>,
): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
        state.detail,
        "Install matching CLI",
        "Choose existing CLI",
        "Installation instructions",
    );
    const command =
        choice === "Install matching CLI"
            ? "forma.installCli"
            : choice === "Choose existing CLI"
              ? "forma.selectCli"
              : choice === "Installation instructions"
                ? "forma.openCliInstructions"
                : undefined;
    if (command) await vscode.commands.executeCommand(command);
}

async function installMatchingCli(
    context: vscode.ExtensionContext,
    runtime: FormaRuntime,
    version: string,
    output: vscode.OutputChannel,
): Promise<void> {
    if (!vscode.workspace.isTrusted) {
        await vscode.window.showWarningMessage("Trust this workspace before installing or executing Forma CLI.");
        return;
    }
    const confirmed = await vscode.window.showInformationMessage(
        `Install Forma CLI ${version} in this Extension Host?`,
        {
            modal: true,
            detail: "Forma will download the exact GitHub Release asset and SHA-256 checksum into VS Code extension storage. It will not modify PATH.",
        },
        "Install",
    );
    if (confirmed !== "Install") return;

    const controller = new AbortController();
    try {
        const installation = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Installing Forma CLI ${version}`,
                cancellable: true,
            },
            async (_progress, token) => {
                const cancellation = token.onCancellationRequested(() => {
                    controller.abort();
                });
                try {
                    return await installManagedCli({
                        version,
                        globalStorage: context.globalStorageUri,
                        replaceExisting:
                            runtime.state.kind === "binaryMissing" || runtime.state.kind === "incompatible",
                        signal: controller.signal,
                    });
                } finally {
                    cancellation.dispose();
                }
            },
        );
        output.appendLine(
            `[install] ${installation.reused ? "Using" : "Installed"} Forma CLI ${version} at ${installation.path}`,
        );

        const configuration = vscode.workspace.getConfiguration("forma");
        const explicitPath = configuration.inspect<string>("path")?.globalValue?.trim();
        if (explicitPath) {
            const useManaged = await vscode.window.showInformationMessage(
                `Forma CLI ${version} is installed, but forma.path remains authoritative.`,
                "Use managed CLI",
            );
            if (useManaged === "Use managed CLI") {
                await configuration.update("path", undefined, vscode.ConfigurationTarget.Global);
            }
        }
        await runtime.refresh();
        if (runtime.state.kind === "ready" || runtime.state.kind === "warning") {
            await vscode.window.showInformationMessage(`Forma CLI ${version} is ready.`);
        } else {
            await vscode.window.showWarningMessage(`${runtime.state.label}. Open Forma Output for details.`);
        }
    } catch (error) {
        if (isCancellation(error)) return;
        const detail = error instanceof Error ? error.message : String(error);
        output.appendLine(`[install] ${detail.replaceAll(/\s+/gu, " ").slice(0, 2_000)}`);
        await vscode.window.showErrorMessage(`Forma CLI installation failed: ${detail}`);
    }
}

async function selectExistingCli(runtime: FormaRuntime): Promise<void> {
    if (!vscode.workspace.isTrusted) {
        await vscode.window.showWarningMessage("Trust this workspace before selecting or executing Forma CLI.");
        return;
    }
    const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        title: "Choose Forma CLI",
        openLabel: "Use Forma CLI",
    });
    const uri = selected?.[0];
    if (!uri) return;
    await vscode.workspace.getConfiguration("forma").update("path", uri.fsPath, vscode.ConfigurationTarget.Global);
    await runtime.refresh();
}

function isCancellation(error: unknown): boolean {
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError") ||
        (typeof error === "object" && error !== null && "kind" in error && error.kind === "cancelled")
    );
}
