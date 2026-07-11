import * as vscode from "vscode";

import { registerNavigation } from "./navigation.ts";
import { openSource, ViewPreviewManager } from "./preview.ts";
import { FormaRuntime } from "./runtime.ts";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const output = vscode.window.createOutputChannel("Forma", { log: true });
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
    const diagnostics = vscode.languages.createDiagnosticCollection("forma");
    const runtime = new FormaRuntime(output);
    const previews = new ViewPreviewManager(runtime);
    status.command = "forma.statusMenu";
    status.name = "Forma";
    status.show();

    const updateStatus = (): void => {
        status.text = `$(repo) ${runtime.state.label}`;
        status.tooltip = stateTooltip(runtime.state);
    };
    context.subscriptions.push(output, status, diagnostics, runtime, previews, runtime.onDidChangeState(updateStatus));
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
        }),
        vscode.commands.registerCommand("forma.openOutput", () => {
            output.show(true);
        }),
        vscode.commands.registerCommand("forma.getRuntimeState", () => runtime.state),
        vscode.commands.registerCommand("forma.openViewPreview", async (uri?: vscode.Uri) => {
            const document = await targetDocument(uri);
            if (document)
                await previews.open(document, vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Active);
        }),
        vscode.commands.registerCommand("forma.openViewPreviewToSide", async (uri?: vscode.Uri) => {
            const document = await targetDocument(uri);
            if (document) await previews.open(document, vscode.ViewColumn.Beside);
        }),
        vscode.commands.registerCommand("forma.openSource", async (uri?: vscode.Uri) => {
            if (uri) await openSource(uri);
        }),
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (document.languageId === "markdown") await previews.refreshAll();
            if (isWorkspaceDefinition(document.uri.path)) await runtime.refresh(document);
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => void runtime.refresh()),
        vscode.window.onDidChangeActiveTextEditor((editor) => void runtime.refresh(editor?.document)),
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

    const selector: vscode.DocumentSelector = [
        { language: "markdown", scheme: "file" },
        { language: "markdown", scheme: "vscode-remote" },
    ];
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(selector, {
            provideCodeLenses(document) {
                const line = document
                    .getText()
                    .split(/\r?\n/u)
                    .findIndex((value) => value.includes("<!-- forma:content -->"));
                if (line < 0) return [];
                const range = new vscode.Range(line, 0, line, document.lineAt(line).text.length);
                return [
                    new vscode.CodeLens(range, {
                        title: "Open Forma Preview",
                        command: "forma.openViewPreview",
                        arguments: [document.uri],
                    }),
                    new vscode.CodeLens(range, {
                        title: "Open Preview to the Side",
                        command: "forma.openViewPreviewToSide",
                        arguments: [document.uri],
                    }),
                ];
            },
        }),
    );
    registerNavigation(context, runtime, diagnostics);
    await runtime.refresh();
}

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
