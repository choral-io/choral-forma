import { beforeEach, describe, expect, it, vi } from "vitest";

const markedMocks = vi.hoisted(() => ({
    parse: vi.fn(),
    use: vi.fn(),
}));

vi.mock("marked", () => ({
    Marked: class {
        parse = markedMocks.parse;
        use = markedMocks.use;
    },
}));

vi.mock("./markdown-katex", () => ({
    markedKatex: {},
}));

vi.mock("./markdown-shiki", () => ({
    markedShiki: {},
}));

import { renderMarkdown } from "./markdown-renderer";

describe("renderMarkdown", () => {
    beforeEach(() => {
        markedMocks.parse.mockReset();
        markedMocks.use.mockReset();
    });

    it("retries once when Markdown rendering fails transiently", async () => {
        markedMocks.parse.mockRejectedValueOnce(new Error("transient render failure"));
        markedMocks.parse.mockResolvedValueOnce("<p>Rendered</p>");

        await expect(renderMarkdown("# Source")).resolves.toBe("<p>Rendered</p>");
        expect(markedMocks.parse).toHaveBeenCalledTimes(2);
    });

    it("reports the failure after both render attempts fail", async () => {
        markedMocks.parse.mockRejectedValue(new Error("persistent render failure"));

        await expect(renderMarkdown("# Source")).rejects.toThrow("persistent render failure");
        expect(markedMocks.parse).toHaveBeenCalledTimes(2);
    });
});
