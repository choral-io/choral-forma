import { describe, expect, it, vi } from "vitest";

const bundledSvg = '<svg xmlns="http://www.w3.org/2000/svg" stroke="#424242"><path d="M1 1" /></svg>';

vi.mock("vscode", () => ({
    ColorThemeKind: { Dark: 2, HighContrast: 3, HighContrastLight: 4 },
    Uri: {
        joinPath: (base: { value: string }, ...segments: string[]) => ({
            value: `${base.value}/${segments.join("/")}`,
        }),
        parse: (value: string) => ({ value }),
    },
    window: {
        activeColorTheme: { kind: 2 },
        onDidChangeActiveColorTheme: () => ({ dispose: vi.fn() }),
    },
    workspace: {
        fs: {
            readFile: async () => new TextEncoder().encode(bundledSvg),
        },
    },
}));

import * as vscode from "vscode";

import { WorkspaceIconCache } from "./workspace-icon-cache.ts";

describe("WorkspaceIconCache", () => {
    it("keeps pending and cached colored icons in the same themed presentation", async () => {
        const cache = new WorkspaceIconCache(vscode.Uri.parse("file:///extension"), vi.fn());
        const pendingFirst = cache.resolve({ icon: "users", color: "#0EA5E9" });
        const pendingSecond = cache.resolve({ icon: "users", color: "#0EA5E9" });
        const [first, second] = await Promise.all([pendingFirst, pendingSecond]);
        const cached = await cache.resolve({ icon: "users", color: "#0EA5E9" });

        expect(first).toEqual(second);
        expect(second).toEqual(cached);
        expect(cached).toMatchObject({
            light: { value: expect.stringMatching(/^data:image\/svg\+xml;base64,/u) },
            dark: { value: expect.stringMatching(/^data:image\/svg\+xml;base64,/u) },
        });
    });
});
