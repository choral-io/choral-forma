import type { InspectEntry, ViewRenderResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import { previewBodyLinks } from "./document-analysis.ts";
import { frontmatterLinks } from "./frontmatter-links.ts";
import {
    clearMarkdownProjections,
    setMarkdownEnhancement,
    type FrontmatterDefaultState,
    type PreviewBodyLink,
} from "./markdown-enhancer.ts";
import { renderViewProjectionHtml } from "./preview-renderer.ts";
import {
    isClassicMarkdownPreviewViewType,
    PreviewRestorationCoordinator,
    viewPathsForPreviewLabels,
    type PreviewRestorationResult,
} from "./preview-restoration.ts";
import type { FormaRuntime } from "./runtime.ts";
import { isFormaViewDocument } from "./view-document.ts";

export class NativePreviewManager implements vscode.Disposable {
    private generation = 0;
    private refreshController: AbortController | undefined;
    private readonly restoration: PreviewRestorationCoordinator<vscode.TextDocument>;

    constructor(private readonly runtime: FormaRuntime) {
        this.restoration = new PreviewRestorationCoordinator({
            isFormaDocument: (document) => this.runtime.isFormaDocument(document),
            refreshDocument: async (document, refreshPreview) => await this.refresh(document, refreshPreview),
            refreshMarkdownPreview: async () => {
                await vscode.commands.executeCommand("markdown.preview.refresh");
            },
            onError: (error) => {
                this.runtime.logResult({
                    previewRestorationError: error instanceof Error ? error.message : String(error),
                });
            },
        });
    }

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
            ...(result ? { projection: renderViewProjectionHtml(result, { locale: vscode.env.language }) } : {}),
            ...(this.runtime.isFormaDocument(document)
                ? { frontmatterDefaultState: this.frontmatterDefaultState(document) }
                : {}),
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

    async restoreOpenState(
        documents: readonly vscode.TextDocument[],
        tabs: readonly vscode.Tab[],
    ): Promise<PreviewRestorationResult> {
        const candidates = new Map(documents.map((document) => [document.uri.toString(), document]));
        for (const document of await this.previewDocuments(tabs)) {
            candidates.set(document.uri.toString(), document);
        }
        return await this.restoration.restoreOpenDocuments([...candidates.values()]);
    }

    async restorePreviewTabs(tabs: readonly vscode.Tab[]): Promise<PreviewRestorationResult> {
        return await this.restoreOpenState([], tabs);
    }

    dispose(): void {
        this.restoration.dispose();
        this.refreshController?.abort();
        clearMarkdownProjections();
    }

    private frontmatterDefaultState(document: vscode.TextDocument): FrontmatterDefaultState {
        const state = vscode.workspace
            .getConfiguration("forma", document.uri)
            .get<FrontmatterDefaultState>("preview.frontmatterDefaultState", "collapsed");
        return state === "expanded" ? "expanded" : "collapsed";
    }

    private async previewDocuments(tabs: readonly vscode.Tab[]): Promise<vscode.TextDocument[]> {
        const resourceUris: vscode.Uri[] = [];
        const classicPreviewLabels: string[] = [];
        for (const tab of tabs) {
            if (tab.input instanceof vscode.TabInputCustom && tab.input.viewType === "vscode.markdown.preview.editor") {
                resourceUris.push(tab.input.uri);
            } else if (
                tab.input instanceof vscode.TabInputWebview &&
                isClassicMarkdownPreviewViewType(tab.input.viewType)
            ) {
                classicPreviewLabels.push(tab.label);
            }
        }
        if (classicPreviewLabels.length > 0) {
            const root = this.runtime.activeRoot;
            const explorer = root ? await this.runtime.workspaceExplorer() : undefined;
            if (root && explorer) {
                for (const path of viewPathsForPreviewLabels(classicPreviewLabels, explorer.views)) {
                    resourceUris.push(this.runtime.uriFor(root, path));
                }
            }
        }
        const documents = new Map<string, vscode.TextDocument>();
        for (const uri of resourceUris) {
            const document = await vscode.workspace.openTextDocument(uri);
            documents.set(document.uri.toString(), document);
        }
        return [...documents.values()];
    }
}
