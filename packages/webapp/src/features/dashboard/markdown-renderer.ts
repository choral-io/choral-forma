import { Marked } from "marked";

import { createMermaidRenderScope, type MermaidRenderScope } from "@/lib/mermaid";

import { markedKatex } from "./markdown-katex";
import { createMarkedMermaid } from "./markdown-mermaid";
import { markedShiki } from "./markdown-shiki";

const markdownRenderAttempts = 2;

export interface MarkdownRenderOptions {
    mermaidScope?: MermaidRenderScope;
    signal?: AbortSignal;
}

export async function renderMarkdown(markdown: string, { mermaidScope, signal }: MarkdownRenderOptions = {}) {
    let lastError: unknown;
    const scope = mermaidScope ?? createMermaidRenderScope("standalone-reader");
    const ownedScope = mermaidScope ? undefined : scope;

    try {
        for (let attempt = 0; attempt < markdownRenderAttempts; attempt += 1) {
            try {
                const parser = new Marked({ gfm: true });
                parser.use(markedKatex, createMarkedMermaid({ scope, signal }), markedShiki);
                return await Promise.resolve(parser.parse(markdown, { async: true }));
            } catch (error: unknown) {
                lastError = error;
            }
        }
    } finally {
        ownedScope?.dispose();
    }

    throw lastError;
}
