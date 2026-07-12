import * as vscode from "vscode";

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
    const runtime = new FormaRuntime(output);
    const previews = new NativePreviewManager(runtime);
    const explorer = new FormaWorkspaceExplorer(runtime, context);
    let workspaceWatchers: vscode.Disposable[] = [];
    let contentRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    let configRefreshTimer: ReturnType<typeof setTimeout> | undefined;

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
        }),
    );
    updateStatus();

    context.subscriptions.push(
        vscode.commands.registerCommand("forma.statusMenu", async () => {
            const choice = await vscode.window.showQuickPick(
                [
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
            await explorer.refresh();
            const document = vscode.window.activeTextEditor?.document;
            if (document && runtime.isFormaDocument(document)) await previews.refresh(document);
        }),
        vscode.commands.registerCommand("forma.refreshExplorer", async () => {
            await explorer.refresh();
        }),
        vscode.commands.registerCommand("forma.openOutput", () => {
            output.show(true);
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
