import { Marked } from "marked";

import { createMermaidRenderScope, type MermaidRenderScope } from "@/lib/mermaid";

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
        parser.use(markedKatex, createMarkedMermaid({ scope, signal }), markedShiki);
        return await Promise.resolve(parser.parse(markdown, { async: true }));
    } finally {
        ownedScope?.dispose();
    }
}
