import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
    original: 'include:\n  - "*.md"\n',
    current: "",
    render: vi.fn<() => string>(),
    write: vi.fn(),
}));

vi.mock("vscode", () => ({
    Uri: { joinPath: (_root: unknown, ...segments: string[]) => segments.join("/") },
    workspace: {
        fs: {
            readFile: async () => new TextEncoder().encode(fixture.current),
            writeFile: async (_uri: unknown, bytes: Uint8Array) => {
                fixture.current = new TextDecoder().decode(bytes);
                fixture.write(fixture.current);
            },
        },
        openTextDocument: async () => ({}),
    },
    commands: { executeCommand: () => fixture.render() },
}));

import { assertPreviewScopeChanges } from "./preview-scope-assertions.ts";

beforeEach(() => {
    fixture.current = fixture.original;
    fixture.write.mockReset();
    fixture.render
        .mockReset()
        .mockImplementation(() =>
            fixture.current === fixture.original ? '<details class="forma-frontmatter">' : "<p>Native content</p>",
        );
});

describe("preview scope fixture lifecycle", () => {
    it("does not emit an extra configuration write after successful restoration", async () => {
        await assertPreviewScopeChanges({} as never);
        expect(fixture.current).toBe(fixture.original);
        expect(fixture.write).toHaveBeenCalledTimes(2);
    });

    it("still restores the original scope if rendering fails while narrowed", async () => {
        fixture.render.mockImplementation(() => {
            if (fixture.current !== fixture.original) throw new Error("render failed");
            return '<details class="forma-frontmatter">';
        });
        await expect(assertPreviewScopeChanges({} as never)).rejects.toThrow("render failed");
        expect(fixture.current).toBe(fixture.original);
        expect(fixture.write).toHaveBeenCalledTimes(2);
    });
});
