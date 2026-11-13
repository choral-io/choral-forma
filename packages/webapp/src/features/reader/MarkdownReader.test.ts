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

vi.mock("./markdown-mermaid", () => ({
    createMarkedMermaid: () => ({}),
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

    it("parses Markdown once so a shared Mermaid scope is not consumed twice", async () => {
        markedMocks.parse.mockResolvedValueOnce("<p>Rendered</p>");

        await expect(renderMarkdown("# Source")).resolves.toBe("<p>Rendered</p>");
        expect(markedMocks.parse).toHaveBeenCalledTimes(1);
    });

    it("reports a render failure without silently retrying", async () => {
        markedMocks.parse.mockRejectedValue(new Error("persistent render failure"));

        await expect(renderMarkdown("# Source")).rejects.toThrow("persistent render failure");
        expect(markedMocks.parse).toHaveBeenCalledTimes(1);
    });
});
