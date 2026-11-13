import { describe, expect, it } from "vitest";

import { createMarkdownHighlighter } from "./markdown-highlighter";

describe("createMarkdownHighlighter", () => {
    it("creates a browser-compatible highlighter with the supported languages and themes", async () => {
        const highlighter = await createMarkdownHighlighter();
        const loadedLanguages = highlighter.getLoadedLanguages();

        expect(loadedLanguages).toEqual(
            expect.arrayContaining([
                "css",
                "html",
                "javascript",
                "json",
                "jsx",
                "markdown",
                "shellscript",
                "tsx",
                "typescript",
                "yaml",
            ]),
        );
        expect(loadedLanguages).toEqual(expect.arrayContaining(["bash", "js", "md", "sh", "shell", "ts", "yml"]));
        expect(highlighter.getLoadedThemes()).toEqual(
            expect.arrayContaining(["github-light-default", "github-dark-default"]),
        );
        expect(
            highlighter.codeToHtml("const answer: number = 42;", {
                lang: "typescript",
                theme: "github-light-default",
            }),
        ).toContain('class="shiki github-light-default"');
    });
});
