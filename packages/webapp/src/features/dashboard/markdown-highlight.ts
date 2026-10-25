import { Lexer, type MarkedExtension, type Token } from "marked";

import { tokenizeInlineMath } from "./markdown-katex";

/** A bounded inline extension: literal double equals, one line, complete inline children. */
export const markedHighlight: MarkedExtension = {
    walkTokens(token) {
        if (token.type !== "image" || !token.tokens) return;
        const literal = (child: Token): Token => {
            if (["formaHighlight", "inlineMath", "literalDoubleDollars"].includes(child.type)) {
                return { type: "text", raw: child.raw, text: child.raw };
            }
            if ("tokens" in child && child.tokens) child.tokens = child.tokens.map(literal);
            return child;
        };
        // Marked's text renderer also dispatches custom renderers. Image alternatives
        // must never acquire generated HTML or MathML from reader extensions.
        token.tokens = token.tokens.map(literal);
    },
    extensions: [
        {
            name: "formaHighlight",
            level: "inline",
            start(source) {
                return source.indexOf("==");
            },
            tokenizer(source) {
                if (
                    !source.startsWith("==") ||
                    source.startsWith("===") ||
                    !source[2] ||
                    /\p{White_Space}/u.test(source[2])
                )
                    return undefined;
                const rest = source.slice(2);
                let offset = 2;
                const protectedTokens: [number, number][] = [];
                for (const token of Lexer.lexInline(rest, { gfm: true })) {
                    if (token.type !== "text") protectedTokens.push([offset, offset + token.raw.length]);
                    offset += token.raw.length;
                }
                for (let index = 2; index < source.length && source[index] !== "\n"; index++) {
                    // Dollars inside escapes, links, code and other complete inline
                    // tokens cannot start math that consumes an outer delimiter.
                    if (protectedTokens.some(([start, end]) => index >= start && index < end)) continue;
                    if (source[index] === "$") {
                        if (source.startsWith("$$", index)) {
                            const end = source.indexOf("$$", index + 2);
                            if (end >= 0) {
                                index = end + 1;
                                continue;
                            }
                        }
                        const math = tokenizeInlineMath(source.slice(index));
                        if (math) {
                            index += math.raw.length - 1;
                            continue;
                        }
                    }
                    if (
                        !source.startsWith("==", index) ||
                        source[index - 1] === "=" ||
                        source[index + 2] === "=" ||
                        /\p{White_Space}/u.test(source[index - 1] ?? "")
                    )
                        continue;
                    let escapes = 0;
                    for (let before = index - 1; source[before] === "\\"; before--) escapes++;
                    if (escapes % 2 || protectedTokens.some(([start, end]) => index >= start && index < end)) continue;
                    const text = source.slice(2, index);
                    return {
                        type: "formaHighlight",
                        raw: source.slice(0, index + 2),
                        tokens: this.lexer.inlineTokens(text),
                    };
                }
                return undefined;
            },
            renderer(token) {
                return `<mark>${this.parser.parseInline((token as Token & { tokens: Token[] }).tokens)}</mark>`;
            },
        },
    ],
};
