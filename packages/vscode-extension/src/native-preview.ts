import type { InspectEntry, ViewRenderResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import { frontmatterLinks } from "./frontmatter-links.ts";
import { clearMarkdownProjections, setMarkdownEnhancement, type PreviewBodyLink } from "./markdown-enhancer.ts";
import { renderViewProjectionHtml } from "./preview-renderer.ts";
import { scanReferenceTokens, wikilinkDisplayLabel } from "./reference-token.ts";
import type { FormaRuntime } from "./runtime.ts";
import { isFormaViewDocument } from "./view-document.ts";

export class NativePreviewManager implements vscode.Disposable {
    private generation = 0;
    private refreshController: AbortController | undefined;
    private readonly bodyLinksCache = new Map<string, PreviewBodyLink[]>();

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
            inspected = (await this.runtime.inspectDocument(document, controller.signal))?.entry;
            bodyLinks = await this.resolveBodyLinks(document, controller.signal);
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

    private async resolveBodyLinks(document: vscode.TextDocument, signal: AbortSignal): Promise<PreviewBodyLink[]> {
        const cacheKey = `${document.uri.toString()}@${String(document.version)}`;
        const cached = this.bodyLinksCache.get(cacheKey);
        if (cached) return cached;
        const tokens = scanReferenceTokens(document.getText())
            .filter((token) => token.syntax === "wikilink" && token.raw)
            .slice(0, 25);
        const links = await Promise.all(
            tokens.map(async (token): Promise<PreviewBodyLink | undefined> => {
                try {
                    const result = await this.runtime.resolveReference(
                        document,
                        token.target,
                        token.intent,
                        token.fragment,
                        signal,
                    );
                    return result?.target && token.raw
                        ? {
                              raw: token.raw,
                              label: wikilinkDisplayLabel(token, result.target.title),
                              targetPath: result.target.path,
                              ...(token.fragment ? { fragment: token.fragment } : {}),
                          }
                        : undefined;
                } catch {
                    return undefined;
                }
            }),
        );
        const resolved = links.filter((link): link is PreviewBodyLink => link !== undefined);
        if (!signal.aborted) {
            this.bodyLinksCache.set(cacheKey, resolved);
            while (this.bodyLinksCache.size > 64) {
                const oldest = this.bodyLinksCache.keys().next().value;
                if (!oldest) break;
                this.bodyLinksCache.delete(oldest);
            }
        }
        return resolved;
    }
}
