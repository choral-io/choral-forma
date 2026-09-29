import { beforeEach, describe, expect, it, vi } from "vitest";

import * as vscode from "vscode";

import { FormaRuntime } from "./runtime.ts";

const mocks = vi.hoisted(() => ({ inspect: vi.fn() }));
vi.mock("node:fs/promises", () => ({ stat: async () => ({ isFile: () => true }) }));
vi.mock("./forma-command-resolution.ts", () => ({
    resolveRuntimeFormaCommand: async () => ({ command: "forma", source: "path" }),
    formaCommandSourceLabel: () => "test",
    formatFormaCommandResolution: () => "test",
}));
vi.mock("./forma-client.ts", () => ({
    FormaClient: class {
        configInspect = mocks.inspect;
        invalidate = vi.fn();
    },
    formatFormaError: String,
    isFormaExecutableUnavailable: () => false,
    runProcess: vi.fn(),
}));
vi.mock("vscode", () => {
    const uri = (fsPath: string) => ({ fsPath, scheme: "file", toString: () => `file://${fsPath}` });
    return {
        EventEmitter: class {
            event = vi.fn();
            fire = vi.fn();
            dispose = vi.fn();
        },
        Uri: {
            file: uri,
            joinPath: (base: { fsPath: string }, ...paths: string[]) => uri([base.fsPath, ...paths].join("/")),
        },
        RelativePattern: class {
            constructor(
                public baseUri: unknown,
                public pattern: string,
            ) {}
        },
        languages: {
            match: (selector: { pattern: { pattern: string } }, document: { uri: { fsPath: string } }) =>
                document.uri.fsPath.endsWith(selector.pattern.pattern) ? 1 : 0,
        },
        window: { activeTextEditor: undefined },
        workspace: {
            isTrusted: true,
            workspaceFolders: [{ uri: uri("/a") }, { uri: uri("/b") }],
            getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback, inspect: () => undefined }),
        },
    };
});

const config = (include: string) => ({
    status: "passed",
    sources: [{ path: ".forma.md" }],
    sourcePatterns: ["settings/*.md"],
    config: { spaces: { arbitrary: { include } } },
});
const document = (path: string) =>
    ({ uri: vscode.Uri.file(path), languageId: "markdown", isUntitled: false }) as vscode.TextDocument;
const runtime = () => new FormaRuntime({ appendLine: vi.fn() } as never, "1.0.0", {} as never);

beforeEach(() => {
    mocks.inspect.mockReset();
});
describe("runtime scope refresh", () => {
    it("refreshes include patterns for every root, including the inactive workspace", async () => {
        const instance = runtime();
        mocks.inspect.mockImplementation(async () => config("notes.md"));
        await instance.refresh(document("/a/notes.md"));
        expect(instance.isFormaDocument(document("/b/notes.md"))).toBe(true);
        mocks.inspect.mockImplementation(async (root: string) => config(root === "/a" ? "notes.md" : "custom/new.md"));
        await instance.refresh(document("/a/notes.md"));
        expect(instance.isFormaDocument(document("/b/notes.md"))).toBe(false);
        expect(instance.isFormaDocument(document("/b/custom/new.md"))).toBe(true);
        expect(instance.workspaceScopes).toHaveLength(2);
        const generation = instance.scopeGeneration;
        instance.invalidateContent();
        expect(instance.scopeGeneration).toBe(generation);
        instance.dispose();
    });

    it("clears a failed inactive scope without disabling a valid active workspace", async () => {
        const instance = runtime();
        mocks.inspect.mockImplementation(async () => config("notes.md"));
        await instance.refresh(document("/a/notes.md"));
        mocks.inspect.mockImplementation(async (root: string) => {
            if (root === "/b") throw new Error("invalid imported configuration");
            return config("notes.md");
        });
        await instance.refresh(document("/a/notes.md"));
        expect(instance.state.kind).toBe("ready");
        expect(instance.isFormaDocument(document("/a/notes.md"))).toBe(true);
        expect(instance.isFormaDocument(document("/b/notes.md"))).toBe(false);
        expect(
            instance.workspaceConfigTargets.some(
                (target) => target.base.fsPath === "/b" && target.pattern === "settings/*.md",
            ),
        ).toBe(true);
        await instance.refresh(document("/a/notes.md"));
        expect(
            instance.workspaceConfigTargets.some(
                (target) => target.base.fsPath === "/b" && target.pattern === "settings/*.md",
            ),
        ).toBe(true);
        instance.dispose();
    });
});
