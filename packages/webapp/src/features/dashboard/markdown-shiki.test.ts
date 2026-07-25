import type { Tokens } from "marked";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shikiMocks = vi.hoisted(() => ({
    createMarkdownHighlighter: vi.fn(),
}));

vi.mock("./markdown-highlighter", () => ({
    createMarkdownHighlighter: shikiMocks.createMarkdownHighlighter,
}));

describe("markedShiki", () => {
    beforeEach(() => {
        vi.resetModules();
        shikiMocks.createMarkdownHighlighter.mockReset();
    });

    it("retries initialization after a transient highlighter failure", async () => {
        const highlighter = highlighterMock();
        shikiMocks.createMarkdownHighlighter.mockRejectedValueOnce(new Error("transient chunk load failure"));
        shikiMocks.createMarkdownHighlighter.mockResolvedValue(highlighter);
        const { markedShiki } = await import("./markdown-shiki");

        const firstToken = codeToken("const first = true;");
        await expect(markedShiki.walkTokens?.(firstToken)).resolves.toBeUndefined();
        expect(firstToken.type).toBe("html");
        expect(shikiMocks.createMarkdownHighlighter).toHaveBeenCalledTimes(2);
    });

    it("reuses a prewarmed highlighter and accepts loaded language aliases", async () => {
        const highlighter = highlighterMock();
        shikiMocks.createMarkdownHighlighter.mockResolvedValue(highlighter);
        const { markedShiki, prewarmMarkdownHighlighter } = await import("./markdown-shiki");

        await prewarmMarkdownHighlighter();
        const token = codeToken("const ready = true;");
        await markedShiki.walkTokens?.(token);

        expect(shikiMocks.createMarkdownHighlighter).toHaveBeenCalledTimes(1);
        expect(highlighter.codeToHtml).toHaveBeenCalledWith(
            "const ready = true;",
            expect.objectContaining({
                lang: "ts",
            }),
        );
        expect((token as unknown as Tokens.HTML).text).toContain('data-language="ts"');
    });

    it("retries during rendering after prewarming exhausts its retries", async () => {
        const highlighter = highlighterMock();
        shikiMocks.createMarkdownHighlighter
            .mockRejectedValueOnce(new Error("first prewarm failure"))
            .mockRejectedValueOnce(new Error("second prewarm failure"))
            .mockResolvedValue(highlighter);
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const { markedShiki, prewarmMarkdownHighlighter } = await import("./markdown-shiki");

        await expect(prewarmMarkdownHighlighter()).resolves.toBeUndefined();
        const token = codeToken("const recovered = true;");
        await markedShiki.walkTokens?.(token);

        expect(shikiMocks.createMarkdownHighlighter).toHaveBeenCalledTimes(3);
        expect(token.type).toBe("html");
        warn.mockRestore();
    });

    it("renders an unsupported language as plain text", async () => {
        const highlighter = highlighterMock();
        shikiMocks.createMarkdownHighlighter.mockResolvedValue(highlighter);
        const { markedShiki } = await import("./markdown-shiki");

        const token = codeToken("some unknown syntax", "not-a-language");
        await markedShiki.walkTokens?.(token);

        expect(highlighter.codeToHtml).toHaveBeenCalledWith(
            "some unknown syntax",
            expect.objectContaining({
                lang: "text",
            }),
        );
        expect((token as unknown as Tokens.HTML).text).toContain('data-language="text"');
    });

    it("leaves Mermaid tokens for the lazy diagram renderer without initializing Shiki", async () => {
        const { markedShiki } = await import("./markdown-shiki");
        const token = codeToken("graph TD\nA --> B", "mermaid");

        await markedShiki.walkTokens?.(token);

        expect(token.type).toBe("code");
        expect(shikiMocks.createMarkdownHighlighter).not.toHaveBeenCalled();
    });
});

function codeToken(text: string, language = "ts"): Tokens.Code {
    return {
        lang: language,
        raw: `\`\`\`${language}\n${text}\n\`\`\``,
        text,
        type: "code",
    };
}

function highlighterMock() {
    return {
        codeToHtml: vi.fn((code: string) => `<pre class="shiki"><code><span class="line">${code}</span></code></pre>`),
        getLoadedLanguages: vi.fn(() => ["ts"]),
    };
}
