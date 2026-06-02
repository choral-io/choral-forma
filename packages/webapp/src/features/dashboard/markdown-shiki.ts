import type { MarkedExtension, Tokens } from "marked";
import { bundledLanguages, createHighlighter, type BundledLanguage, type HighlighterGeneric } from "shiki";

const languages = new Set(Object.keys(bundledLanguages));
const initialLanguages = ["css", "html", "js", "json", "jsx", "md", "sh", "shell", "ts", "tsx", "yaml"] as const;

type MarkdownHighlighter = HighlighterGeneric<BundledLanguage, "github-light-default" | "github-dark-default">;

let highlighterPromise: Promise<MarkdownHighlighter> | undefined;

export const markedShiki: MarkedExtension = {
    async walkTokens(token) {
        if (token.type !== "code" || typeof token.text !== "string") {
            return;
        }

        const codeToken = token as Tokens.Code;
        const language = normalizeLanguage(codeToken.lang);
        const highlighter = await getHighlighter();

        if (!highlighter.getLoadedLanguages().includes(language) && languages.has(language)) {
            await highlighter.loadLanguage(language as BundledLanguage);
        }

        token.type = "html";

        const resolvedLanguage = languages.has(language) ? language : "text";
        const htmlToken = token as Tokens.HTML;
        htmlToken.raw = codeToken.text;
        htmlToken.pre = true;
        htmlToken.block = true;
        htmlToken.text = addLanguageLabel(
            highlighter.codeToHtml(codeToken.text, {
                lang: resolvedLanguage,
                themes: {
                    dark: "github-dark-default",
                    light: "github-light-default",
                },
            }),
            resolvedLanguage,
        );
    },
};

function getHighlighter() {
    highlighterPromise ??= createHighlighter({
        langs: initialLanguages.filter((language) => languages.has(language)),
        themes: ["github-light-default", "github-dark-default"],
    });

    return highlighterPromise;
}

function normalizeLanguage(language: string | undefined) {
    const normalized = language ? (/\S*/.exec(language)?.[0] ?? "text").toLowerCase() : "text";

    switch (normalized) {
        case "bash":
            return "sh";
        case "shell":
            return "shell";
        case "yml":
            return "yaml";
        default:
            return normalized;
    }
}

function addLanguageLabel(html: string, language: string) {
    return html.replace("<pre ", `<pre data-language="${escapeHtmlAttribute(language)}" `);
}

function escapeHtmlAttribute(value: string) {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
