import type { MarkedExtension, Tokens } from "marked";
import type { HighlighterCore } from "shiki/core";

let highlighterPromise: Promise<HighlighterCore> | undefined;

export const markedShiki: MarkedExtension = {
    async walkTokens(token) {
        if (token.type !== "code" || typeof token.text !== "string") {
            return;
        }

        const codeToken = token as Tokens.Code;
        const language = codeToken.lang?.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "text";
        try {
            const highlighter = await getHighlighterWithRetry();
            const resolvedLanguage = highlighter.getLoadedLanguages().includes(language) ? language : "text";
            const highlighted = highlighter.codeToHtml(codeToken.text, {
                lang: resolvedLanguage,
                themes: {
                    dark: "github-dark-default",
                    light: "github-light-default",
                },
                defaultColor: "light-dark()",
                rootStyle: false,
            });

            token.type = "html";

            const htmlToken = token as Tokens.HTML;
            htmlToken.raw = codeToken.text;
            htmlToken.pre = true;
            htmlToken.block = true;
            htmlToken.text = addLanguageLabel(highlighted, resolvedLanguage);
        } catch (error: unknown) {
            console.warn("Syntax highlighting failed; rendering plain code.", error);
        }
    },
};

export async function prewarmMarkdownHighlighter() {
    try {
        await getHighlighterWithRetry();
    } catch (error: unknown) {
        console.warn("Syntax highlighter prewarm failed; rendering will retry when needed.", error);
    }
}

async function getHighlighterWithRetry() {
    try {
        return await getHighlighter();
    } catch {
        return getHighlighter();
    }
}

function getHighlighter() {
    highlighterPromise ??= import("./markdown-highlighter")
        .then(({ createMarkdownHighlighter }) => createMarkdownHighlighter())
        .catch((error: unknown) => {
            highlighterPromise = undefined;
            throw error;
        });

    return highlighterPromise;
}

function addLanguageLabel(html: string, language: string) {
    return html.replace("<pre ", `<pre data-language="${escapeHtmlAttribute(language)}" `);
}

function escapeHtmlAttribute(value: string) {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
