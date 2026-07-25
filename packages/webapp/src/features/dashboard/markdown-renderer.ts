import { Marked } from "marked";

import { markedKatex } from "./markdown-katex";
import { createMarkedMermaid } from "./markdown-mermaid";
import { markedShiki } from "./markdown-shiki";

const markdownRenderAttempts = 2;

export async function renderMarkdown(markdown: string) {
    let lastError: unknown;

    for (let attempt = 0; attempt < markdownRenderAttempts; attempt += 1) {
        try {
            const parser = new Marked({ gfm: true });
            parser.use(markedKatex, createMarkedMermaid(), markedShiki);
            return await Promise.resolve(parser.parse(markdown, { async: true }));
        } catch (error: unknown) {
            lastError = error;
        }
    }

    throw lastError;
}
