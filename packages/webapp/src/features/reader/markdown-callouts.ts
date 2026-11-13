import type { MarkedExtension } from "marked";

const types = {
    NOTE: ["Note", "alert-info"],
    TIP: ["Tip", "alert-success"],
    IMPORTANT: ["Important", ""],
    WARNING: ["Warning", "alert-warning"],
    CAUTION: ["Caution", "alert-error"],
} as const;

/** Transform only parser-owned blockquotes; raw HTML is not extension syntax. */
export const markedCallouts: MarkedExtension = {
    renderer: {
        blockquote(token) {
            const first = token.tokens[0];
            if (first?.type !== "paragraph") return false;
            const marker = first.raw.split(/\r?\n/u)[0];
            const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]([+-])?(?:[ \t]+(\S.*))?$/iu.exec(marker ?? "");
            const identifier = match?.[1];
            if (!identifier) return false;
            const type = identifier.toUpperCase() as keyof typeof types;
            const [defaultTitle, color] = types[type];
            const folding = match[2];
            const prefix = `[!${identifier}]${folding ?? ""}`;
            const inlineTokens = first.tokens ?? [];
            // Inline constructs spanning the header/body boundary cannot be split safely.
            let offset = 0;
            for (const token of inlineTokens) {
                const end = offset + token.raw.length;
                if (
                    offset <= (marker?.length ?? 0) &&
                    end > (marker?.length ?? 0) &&
                    token.raw.includes("\n") &&
                    !["text", "br"].includes(token.type)
                )
                    return false;
                offset = end;
            }
            const hardBreak = inlineTokens.findIndex((token) => token.type === "br");
            let title: string;
            let body: string;
            if (hardBreak >= 0 && (marker?.endsWith("  ") || marker?.endsWith("\\"))) {
                // Render each token once, preserving footnote/reference state and inline HTML.
                const header = this.parser.parseInline(inlineTokens.slice(0, hardBreak));
                if (!header.startsWith(prefix)) return false;
                title = header.slice(prefix.length).trim();
                const inlineBody = this.parser.parseInline(inlineTokens.slice(hardBreak + 1));
                body = (inlineBody ? `<p>${inlineBody}</p>\n` : "") + this.parser.parse(token.tokens.slice(1));
            } else {
                const html = this.parser.parse(token.tokens);
                const paragraphPrefix = `<p>${prefix}`;
                if (!html.startsWith(paragraphPrefix)) return false;
                const newline = html.indexOf("\n", paragraphPrefix.length);
                const paragraphEnd = html.indexOf("</p>", paragraphPrefix.length);
                if (paragraphEnd < 0) return false;
                const hasBodyLine = newline >= 0 && newline < paragraphEnd;
                const titleEnd = hasBodyLine ? newline : paragraphEnd;
                title = html.slice(paragraphPrefix.length, titleEnd).trim();
                body = hasBodyLine
                    ? `<p>${html.slice(titleEnd + 1)}`
                    : html.slice(paragraphEnd + 4).replace(/^\n/u, "");
            }
            title ||= defaultTitle;
            if (folding) {
                return `<aside class="alert alert-soft ${color} forma-callout" data-callout="${type.toLowerCase()}"><details class="collapse collapse-arrow" data-callout-fold=""${folding === "+" ? " open" : ""}><summary class="collapse-title forma-callout-title min-h-0 py-1 ps-0 pe-12">${title}</summary><div class="collapse-content p-0">${body}</div></details></aside>\n`;
            }
            return `<aside class="alert alert-soft ${color} forma-callout" data-callout="${type.toLowerCase()}"><div class="min-w-0 w-full"><p class="forma-callout-title">${title}</p>${body}</div></aside>\n`;
        },
    },
};
