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
        runtime.onDidChangeState(() => {
            updateStatus();
            if (runtime.state.kind !== "checking") void explorer.refresh();
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
            if (document?.languageId === "markdown") await previews.refresh(document);
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
            if (document.languageId === "markdown") await previews.refresh(document);
            if (isWorkspaceDefinition(document.uri.path)) await runtime.refresh(document);
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
                if (editor?.document.languageId === "markdown") await previews.refresh(editor.document);
            })();
        }),
        vscode.workspace.onDidGrantWorkspaceTrust(() => void runtime.refresh()),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration("forma")) void runtime.refresh();
        }),
    );

    for (const pattern of ["**/.forma.md", "**/.forma/**/*.md"]) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        context.subscriptions.push(
            watcher,
            watcher.onDidCreate(() => void runtime.refresh()),
            watcher.onDidChange(() => void runtime.refresh()),
            watcher.onDidDelete(() => void runtime.refresh()),
        );
    }

    registerNavigation(context, runtime, diagnostics);
    await runtime.refresh();
    const document = vscode.window.activeTextEditor?.document;
    if (document?.languageId === "markdown") await previews.refresh(document);
    return { extendMarkdownIt };
}

export { extendMarkdownIt };
export type { MarkdownIt };

async function targetDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
    if (uri) return await vscode.workspace.openTextDocument(uri);
    return vscode.window.activeTextEditor?.document;
}

function isWorkspaceDefinition(path: string): boolean {
    return path.endsWith("/.forma.md") || path.includes("/.forma/");
}

function stateTooltip(state: FormaRuntime["state"]): string {
    if ("detail" in state) return `${state.label}\n${state.detail}`;
    if ("root" in state) return `${state.label}\n${state.root}`;
    return state.label;
}
