import { Marked } from "marked";
import markedFootnote from "marked-footnote";

import { createMermaidRenderScope, type MermaidRenderScope } from "@/lib/mermaid";

import { markedCallouts } from "./markdown-callouts";
import { markedKatex } from "./markdown-katex";
import { createMarkedMermaid } from "./markdown-mermaid";
import { markedShiki } from "./markdown-shiki";

export interface MarkdownRenderOptions {
    mermaidScope?: MermaidRenderScope;
    signal?: AbortSignal;
}

/**
 * Parses once. A retry would reuse the caller's Mermaid scope, whose per-scope
 * budget the first attempt has already consumed, so every diagram would silently
 * degrade to a code block on the second pass.
 */
export async function renderMarkdown(markdown: string, { mermaidScope, signal }: MarkdownRenderOptions = {}) {
    const scope = mermaidScope ?? createMermaidRenderScope("standalone-reader");
    const ownedScope = mermaidScope ? undefined : scope;

    try {
        const parser = new Marked({ gfm: true });
        parser.use(
            markedFootnote({ prefixId: "user-content-fn-", backRefLabel: "Back to content" }),
            markedCallouts,
            markedKatex,
            createMarkedMermaid({ scope, signal }),
            markedShiki,
        );
        const html = await Promise.resolve(parser.parse(markdown, { async: true }));
        // Match Core's existing footnote targets in static HTML.
        return html
            .replaceAll('id="user-content-fn-ref-', 'id="user-content-fnref-')
            .replaceAll('href="#user-content-fn-ref-', 'href="#user-content-fnref-');
    } finally {
        ownedScope?.dispose();
    }
}
