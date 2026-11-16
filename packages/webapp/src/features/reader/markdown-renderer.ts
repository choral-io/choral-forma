import { Lexer, Marked, type MarkedOptions, type Token, type TokensList } from "marked";
import markedFootnote from "marked-footnote";

import { createMermaidRenderScope, type MermaidRenderScope } from "@/lib/mermaid";

import { markedCallouts } from "./markdown-callouts";
import { markedDisclosureSafety, prepareDisclosures, restoreDisclosures } from "./markdown-disclosures";
import { markedHighlight } from "./markdown-highlight";
import { markedKatex } from "./markdown-katex";
import { createMarkedMermaid } from "./markdown-mermaid";
import { markedShiki } from "./markdown-shiki";

export interface MarkdownRenderOptions {
    mermaidScope?: MermaidRenderScope;
    projectionBoundary?: string;
    signal?: AbortSignal;
}

export function markdownAroundProjection(before: string, after: string) {
    let name = "forma-rendered-projection";
    while (before.includes(name) || after.includes(name)) name += "-";
    const boundary = `<!--${name}-->`;
    return { boundary, markdown: before + boundary + after };
}

/**
 * Parses once. A retry would reuse the caller's Mermaid scope, whose per-scope
 * budget the first attempt has already consumed, so every diagram would silently
 * degrade to a code block on the second pass.
 */
export async function renderMarkdown(
    markdown: string,
    { mermaidScope, projectionBoundary, signal }: MarkdownRenderOptions = {},
) {
    const scope = mermaidScope ?? createMermaidRenderScope("standalone-reader");
    const ownedScope = mermaidScope ? undefined : scope;

    try {
        const disclosure = prepareDisclosures(markdown);
        const parser = new Marked({ gfm: true });
        parser.use(
            markedFootnote({ prefixId: "user-content-fn-", backRefLabel: "Back to content" }),
            markedCallouts,
            markedDisclosureSafety,
            markedHighlight,
            markedKatex,
            createMarkedMermaid({ scope, signal }),
            markedShiki,
        );
        if (projectionBoundary) {
            parser.use({
                hooks: {
                    provideLexer() {
                        return (source, options) => {
                            return new ProjectionLexer(projectionBoundary, options).lex(source);
                        };
                    },
                },
            });
        }
        const html = await Promise.resolve(parser.parse(disclosure.source, { async: true }));
        // Match Core's existing footnote targets in static HTML.
        return restoreDisclosures(html, disclosure.replacements)
            .replaceAll('id="user-content-fn-ref-', 'id="user-content-fnref-')
            .replaceAll('href="#user-content-fn-ref-', 'href="#user-content-fnref-');
    } finally {
        ownedScope?.dispose();
    }
}

/** Keep the projection between two block runs while sharing deferred inline parsing and footnotes. */
class ProjectionLexer<ParserOutput, RendererOutput> extends Lexer<ParserOutput, RendererOutput> {
    private readonly boundary: string;

    constructor(boundary: string, options?: MarkedOptions<ParserOutput, RendererOutput>) {
        super(options);
        this.boundary = boundary;
    }

    override blockTokens(source: string, tokens?: TokensList, lastParagraphClipped?: boolean): TokensList;
    override blockTokens(source: string, tokens?: Token[], lastParagraphClipped?: boolean): Token[];
    override blockTokens(source: string, tokens?: Token[], lastParagraphClipped?: boolean) {
        const offset = tokens === this.tokens ? source.indexOf(this.boundary) : -1;
        if (offset < 0) return super.blockTokens(source, tokens, lastParagraphClipped);

        // Initialize document extensions before the boundary, even for an empty first section.
        super.blockTokens(source.slice(0, offset) || "\n", this.tokens);
        this.tokens.push({ type: "html", raw: this.boundary, text: this.boundary, block: true, pre: false });
        return super.blockTokens(source.slice(offset + this.boundary.length), this.tokens);
    }
}
