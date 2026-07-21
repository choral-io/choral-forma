import type { InspectEntry, ViewRenderResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import { previewBodyLinks } from "./document-analysis.ts";
import { frontmatterLinks } from "./frontmatter-links.ts";
import {
    clearMarkdownProjections,
    setMarkdownEnhancement,
    type FrontmatterDefaultState,
    type MarkdownEnhancement,
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
    private activePath: string | undefined;
    private readonly graphPreviews = new Map<
        string,
        { result: ViewRenderResult; enhancement: Omit<MarkdownEnhancement, "projection"> }
    >();
    private readonly refreshes = new Map<string, { controller: AbortController; generation: number }>();
    private readonly restoration: PreviewRestorationCoordinator<vscode.TextDocument>;

    constructor(private readonly runtime: FormaRuntime) {
        this.activePath = this.managedPath(vscode.window.activeTextEditor?.document);
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
        const key = document.uri.toString();
        const previous = this.refreshes.get(key);
        previous?.controller.abort();
        const controller = new AbortController();
        const generation = (previous?.generation ?? 0) + 1;
        this.refreshes.set(key, { controller, generation });
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
        if (this.refreshes.get(key)?.generation !== generation) return false;
        const enhancement = {
            ...(this.runtime.isFormaDocument(document)
                ? { frontmatterDefaultState: this.frontmatterDefaultState(document) }
                : {}),
            frontmatterLinks: frontmatterLinks(inspected),
            bodyLinks,
        } satisfies Omit<MarkdownEnhancement, "projection">;
        setMarkdownEnhancement(key, {
            ...enhancement,
            ...(result
                ? {
                      projection: renderViewProjectionHtml(result, {
                          ...(this.activePath ? { activePath: this.activePath } : {}),
                          locale: vscode.env.language,
                      }),
                  }
                : {}),
        });
        if (result?.render?.kind === "graph") this.graphPreviews.set(key, { result, enhancement });
        else this.graphPreviews.delete(key);
        this.refreshes.delete(key);
        if (refreshPreview) void vscode.commands.executeCommand("markdown.preview.refresh");
        return result !== undefined;
    }

    activeDocumentChanged(document: vscode.TextDocument | undefined, refreshPreview = true): boolean {
        const activePath = this.managedPath(document);
        if (activePath === this.activePath) return false;
        this.activePath = activePath;
        for (const [key, state] of this.graphPreviews) {
            setMarkdownEnhancement(key, {
                ...state.enhancement,
                projection: renderViewProjectionHtml(state.result, {
                    ...(activePath ? { activePath } : {}),
                    locale: vscode.env.language,
                }),
            });
        }
        if (refreshPreview && this.graphPreviews.size > 0) {
            void vscode.commands.executeCommand("markdown.preview.refresh");
        }
        return this.graphPreviews.size > 0;
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

    async closePreviewTabs(tabs: readonly vscode.Tab[]): Promise<number> {
        let removed = 0;
        for (const document of await this.previewDocuments(tabs)) {
            if (this.graphPreviews.delete(document.uri.toString())) removed += 1;
        }
        return removed;
    }

    dispose(): void {
        this.restoration.dispose();
        for (const refresh of this.refreshes.values()) refresh.controller.abort();
        this.refreshes.clear();
        this.graphPreviews.clear();
        clearMarkdownProjections();
    }

    private frontmatterDefaultState(document: vscode.TextDocument): FrontmatterDefaultState {
        const state = vscode.workspace
            .getConfiguration("forma", document.uri)
            .get<FrontmatterDefaultState>("preview.frontmatterDefaultState", "collapsed");
        return state === "expanded" ? "expanded" : "collapsed";
    }

    private managedPath(document: vscode.TextDocument | undefined): string | undefined {
        if (!document || !this.runtime.isFormaDocument(document)) return undefined;
        return this.runtime.sourcePath(document)?.path;
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
