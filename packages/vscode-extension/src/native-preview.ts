import type { InspectEntry, ViewRenderResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import { previewBodyLinks } from "./document-analysis.ts";
import { frontmatterLinks } from "./frontmatter-links.ts";
import { clearMarkdownProjections, setMarkdownEnhancement, type PreviewBodyLink } from "./markdown-enhancer.ts";
import { renderViewProjectionHtml } from "./preview-renderer.ts";
import type { FormaRuntime } from "./runtime.ts";
import { isFormaViewDocument } from "./view-document.ts";

export class NativePreviewManager implements vscode.Disposable {
    private generation = 0;
    private refreshController: AbortController | undefined;

    constructor(private readonly runtime: FormaRuntime) {}

    async refresh(document: vscode.TextDocument, refreshPreview = true): Promise<boolean> {
        this.refreshController?.abort();
        const controller = new AbortController();
        this.refreshController = controller;
        const generation = ++this.generation;
        let result: ViewRenderResult | undefined;
        let inspected: InspectEntry | undefined;
        let bodyLinks: PreviewBodyLink[] = [];
        try {
            const inspectResult = await this.runtime.inspectDocument(document, controller.signal);
            inspected = inspectResult?.entry;
            bodyLinks = previewBodyLinks(document.getText(), inspectResult);
            if (isFormaViewDocument(document.languageId, inspected?.kind)) {
                result = await this.runtime.renderView(document, controller.signal);
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                this.runtime.logResult({ nativePreviewError: error instanceof Error ? error.message : String(error) });
            }
        }
        if (generation !== this.generation) return false;
        const key = document.uri.toString();
        setMarkdownEnhancement(key, {
            ...(result ? { projection: renderViewProjectionHtml(result) } : {}),
            frontmatterLinks: frontmatterLinks(inspected),
            bodyLinks,
        });
        if (refreshPreview) void vscode.commands.executeCommand("markdown.preview.refresh");
        return result !== undefined;
    }

    async open(document: vscode.TextDocument, sideBySide: boolean): Promise<void> {
        await this.refresh(document, false);
        await vscode.commands.executeCommand(
            sideBySide ? "markdown.showPreviewToSide" : "markdown.showPreview",
            document.uri,
        );
    }

    dispose(): void {
        this.refreshController?.abort();
        clearMarkdownProjections();
    }
}
