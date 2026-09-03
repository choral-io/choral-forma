import type katex from "katex";
import type { MarkedExtension, Token } from "marked";

interface MathToken {
    type: "blockMath" | "inlineMath";
    raw: string;
    math: string;
    html?: string;
}

interface InlineMathToken extends MathToken {
    type: "inlineMath";
}

interface BlockMathToken extends MathToken {
    type: "blockMath";
}

type KatexRenderer = typeof katex;

let katexPromise: Promise<KatexRenderer> | undefined;

/**
 * KaTeX and its stylesheet are the largest part of the reader pipeline and most
 * documents contain no math, so they load on the first math token rather than
 * with the reader. Tokenizing decides that, which keeps the loading rule and the
 * math syntax rule in one place.
 */
function loadKatex() {
    katexPromise ??= Promise.all([import("katex"), import("./markdown-katex-styles")])
        .then(([module]) => module.default)
        .catch((error: unknown) => {
            katexPromise = undefined;
            throw error;
        });

    return katexPromise;
}

function isMathToken(token: Token): token is Token & MathToken {
    return token.type === "blockMath" || token.type === "inlineMath";
}

function escapeMathSource(raw: string) {
    return raw.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function findUnescapedDollar(source: string, start: number) {
    for (let index = start; index < source.length; index += 1) {
        if (source[index] !== "$") {
            continue;
        }

        let precedingBackslashes = 0;
        for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
            precedingBackslashes += 1;
        }

        if (precedingBackslashes % 2 === 0) {
            return index;
        }
    }

    return -1;
}

function tokenizeInlineMath(source: string): InlineMathToken | undefined {
    if (!source.startsWith("$") || source.startsWith("$$") || /\s/.test(source[1] ?? "")) {
        return undefined;
    }

    const closingIndex = findUnescapedDollar(source, 1);
    if (closingIndex < 1) {
        return undefined;
    }

    const math = source.slice(1, closingIndex);
    const followsCloser = source[closingIndex + 1] ?? "";
    if (
        math.includes("\n") ||
        math.includes("`") ||
        math.includes("\\$") ||
        math.endsWith(" ") ||
        math.endsWith("\t") ||
        /^[+-]?\d+(?:[.,]\d+)?$/.test(math) ||
        (/^\d/.test(math) && /^\d/.test(followsCloser))
    ) {
        return undefined;
    }

    return {
        type: "inlineMath",
        raw: source.slice(0, closingIndex + 1),
        math,
    };
}

function renderFormula(katex: KatexRenderer, math: string, displayMode: boolean) {
    return katex.renderToString(math, {
        displayMode,
        throwOnError: false,
        errorColor: "var(--color-error)",
        output: "htmlAndMathml",
        trust: false,
        maxSize: 20,
        maxExpand: 1000,
    });
}

export const markedKatex: MarkedExtension = {
    async walkTokens(token) {
        if (!isMathToken(token)) {
            return;
        }

        try {
            const katex = await loadKatex();
            token.html = renderFormula(katex, token.math, token.type === "blockMath");
        } catch (error: unknown) {
            console.warn("Math rendering failed; rendering the source text.", error);
        }
    },
    extensions: [
        {
            name: "blockMath",
            level: "block",
            start(source) {
                return /^\$\$[ \t]*$/m.exec(source)?.index;
            },
            tokenizer(source) {
                const match = /^\$\$[ \t]*\r?\n([\s\S]*?)\r?\n\$\$[ \t]*(?:\r?\n|$)/.exec(source);
                const math = match?.[1]?.trim();
                if (!match || !math) {
                    return undefined;
                }

                return {
                    type: "blockMath",
                    raw: match[0],
                    math,
                } satisfies BlockMathToken;
            },
            renderer(token) {
                const mathToken = token as BlockMathToken;
                return `${mathToken.html ?? escapeMathSource(mathToken.raw)}\n`;
            },
        },
        {
            name: "inlineMath",
            level: "inline",
            start(source) {
                return findUnescapedDollar(source, 0);
            },
            tokenizer(source) {
                return tokenizeInlineMath(source);
            },
            renderer(token) {
                const mathToken = token as InlineMathToken;
                return mathToken.html ?? escapeMathSource(mathToken.raw);
            },
        },
    ],
};
