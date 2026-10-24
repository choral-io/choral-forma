import { beforeEach, describe, expect, it, vi } from "vitest";
import { withCleanViewDiagnostics } from "./view-preview-assertions.ts";

const state = vi.hoisted(() => ({
    original: "# Note\n[[same]] [[missing]]",
    text: "",
    command: vi.fn<() => Promise<void>>(),
}));
vi.mock("vscode", () => ({
    Position: class {
        constructor(
            readonly line: number,
            readonly character: number,
        ) {}
    },
    Range: class {
        constructor(
            readonly start: unknown,
            readonly end: unknown,
        ) {}
    },
    WorkspaceEdit: class {
        replacement = "";
        replace(_uri: unknown, _range: unknown, replacement: string) {
            this.replacement = replacement;
        }
    },
    workspace: {
        applyEdit: async (edit: { replacement: string }) => {
            state.text = edit.replacement;
            return true;
        },
    },
    commands: { executeCommand: () => state.command() },
}));
const document = {
    uri: {},
    getText: () => state.text,
    positionAt: () => ({ line: 1, character: 0 }),
    save: async () => true,
};
beforeEach(() => {
    state.text = state.original;
    state.command.mockReset().mockResolvedValue(undefined);
});
describe("view diagnostic fixture error reporting", () => {
    it("preserves the original assertion while restoring the note", async () => {
        const originalError = new Error("missing projection");
        await expect(
            withCleanViewDiagnostics(document as never, async () => {
                throw originalError;
            }),
        ).rejects.toBe(originalError);
        expect(state.text).toBe(state.original);
    });
    it("reports both the assertion and restoration errors without masking the first", async () => {
        const originalError = new Error("missing projection");
        const cleanupError = new Error("refresh cancelled");
        state.command.mockResolvedValueOnce(undefined).mockRejectedValueOnce(cleanupError);
        const error = await withCleanViewDiagnostics(document as never, async () => {
            throw originalError;
        }).catch((error: unknown) => error);
        expect(error).toBeInstanceOf(AggregateError);
        expect((error as AggregateError).errors).toEqual([originalError, cleanupError]);
        expect(state.text).toBe(state.original);
    });
});
