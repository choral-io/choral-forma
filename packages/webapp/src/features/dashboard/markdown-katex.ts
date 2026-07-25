import katex from "katex";
import type { MarkedExtension } from "marked";

interface InlineMathToken {
    type: "inlineMath";
    raw: string;
    math: string;
}

interface BlockMathToken {
    type: "blockMath";
    raw: string;
    math: string;
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

function renderFormula(math: string, displayMode: boolean) {
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
                return `${renderFormula((token as BlockMathToken).math, true)}\n`;
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
                return renderFormula((token as InlineMathToken).math, false);
            },
        },
    ],
};
