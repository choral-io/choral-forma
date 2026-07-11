import { randomBytes } from "node:crypto";

import type { ViewRenderResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import { renderViewHtml } from "./preview-renderer.ts";
import type { FormaRuntime } from "./runtime.ts";

type PreviewEntry = {
    panel: vscode.WebviewPanel;
    documentUri: vscode.Uri;
    generation: number;
    controller?: AbortController;
};

export class ViewPreviewManager implements vscode.Disposable {
    private readonly previews = new Map<string, PreviewEntry>();

    constructor(private readonly runtime: FormaRuntime) {}

    async open(document: vscode.TextDocument, viewColumn: vscode.ViewColumn): Promise<void> {
        const key = document.uri.toString();
        const existing = this.previews.get(key);
        if (existing) {
            existing.panel.reveal(viewColumn, true);
            await this.refresh(existing);
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            "forma.viewPreview",
            `Forma: ${basename(document.uri.path)}`,
            viewColumn,
            {
                enableFindWidget: true,
                enableScripts: true,
                localResourceRoots: [],
                retainContextWhenHidden: true,
            },
        );
        const entry: PreviewEntry = { panel, documentUri: document.uri, generation: 0 };
        this.previews.set(key, entry);
        panel.onDidDispose(() => {
            entry.controller?.abort();
            this.previews.delete(key);
        });
        panel.webview.onDidReceiveMessage(async (message: unknown) => {
            if (!isOpenSourceMessage(message) || !isSafeWorkspacePath(message.path)) return;
            const source = this.runtime.sourcePath(document);
            if (!source) return;
            await openSource(this.runtime.uriFor(source.root, message.path), message.line, message.column);
        });
        await this.refresh(entry);
    }

    async refreshForDocument(document: vscode.TextDocument): Promise<void> {
        const entry = this.previews.get(document.uri.toString());
        if (entry) await this.refresh(entry);
    }

    async refreshAll(): Promise<void> {
        await Promise.all(
            [...this.previews.values()].map(async (entry) => {
                await this.refresh(entry);
            }),
        );
    }

    dispose(): void {
        for (const entry of this.previews.values()) {
            entry.controller?.abort();
            entry.panel.dispose();
        }
        this.previews.clear();
    }

    private async refresh(entry: PreviewEntry): Promise<void> {
        entry.controller?.abort();
        const controller = new AbortController();
        entry.controller = controller;
        const generation = ++entry.generation;
        const document = await vscode.workspace.openTextDocument(entry.documentUri);
        let result: ViewRenderResult | undefined;
        try {
            result = await this.runtime.renderView(document, controller.signal);
        } catch (error) {
            if (!controller.signal.aborted) {
                this.runtime.logResult({ previewError: error instanceof Error ? error.message : String(error) });
                entry.panel.webview.html = unavailableHtml();
            }
            return;
        }
        if (controller.signal.aborted || generation !== entry.generation) return;
        if (!result) {
            entry.panel.webview.html = unavailableHtml();
            return;
        }
        const nonce = randomBytes(16).toString("base64");
        entry.panel.title = `Forma: ${result.view?.title ?? basename(document.uri.path)}`;
        entry.panel.webview.html = renderViewHtml(result, nonce, entry.panel.webview.cspSource);
    }
}

export async function openSource(uri: vscode.Uri, line?: number, column?: number): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    if (line !== undefined) {
        const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, (column ?? 1) - 1));
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
}

function unavailableHtml(): string {
    return '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\';"></head><body><h1>Forma preview unavailable</h1><p>Trust the workspace and install a compatible Forma binary, then refresh.</p></body></html>';
}

function basename(path: string): string {
    return path.split("/").pop() ?? path;
}

function isOpenSourceMessage(value: unknown): value is {
    type: "openSource";
    path: string;
    line?: number;
    column?: number;
} {
    return (
        typeof value === "object" &&
        value !== null &&
        "type" in value &&
        value.type === "openSource" &&
        "path" in value &&
        typeof value.path === "string" &&
        (!("line" in value) || value.line === undefined || typeof value.line === "number") &&
        (!("column" in value) || value.column === undefined || typeof value.column === "number")
    );
}

function isSafeWorkspacePath(value: string): boolean {
    return (
        value !== "" &&
        !value.startsWith("/") &&
        !value.includes("\\") &&
        !/^[a-z]:/iu.test(value) &&
        value.split("/").every((segment) => segment !== ".." && segment !== "." && segment !== "")
    );
}
