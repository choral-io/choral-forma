import { describe, expect, it } from "vitest";

import {
    configuredWorkspace,
    discoverWorkspaceRoots,
    selectWorkspaceRoot,
    shouldRefreshRuntimeForDocument,
    workspaceRelativePath,
    workspaceScopeFromConfig,
} from "./workspace-discovery.ts";

const existing =
    (...paths: string[]) =>
    async (path: string): Promise<boolean> =>
        paths.includes(path);

describe("workspace discovery", () => {
    it("discovers default and explicitly configured workspace roots", async () => {
        const result = await discoverWorkspaceRoots(
            [configuredWorkspace("/repo", undefined), configuredWorkspace("/other", "docs/.forma.md")],
            existing("/repo/.forma.md", "/repo/nested/.forma.md", "/other/.forma.md"),
        );
        expect(result.roots).toEqual(["/repo"]);
        expect(result.missing.map((workspace) => workspace.configRelativePath)).toEqual(["docs/.forma.md"]);
        expect(selectWorkspaceRoot(result.roots, "/repo/nested/note.md")).toBe("/repo");
    });

    it("discovers one, two, and five explicit workspace roots without nested scanning", async () => {
        const folders = Array.from({ length: 5 }, (_, index) =>
            configuredWorkspace(`/repo-${String(index + 1)}`, undefined),
        );
        const present = folders.map((folder) => folder.configPath);
        for (const count of [1, 2, 5]) {
            const result = await discoverWorkspaceRoots(folders.slice(0, count), existing(...present));
            expect(result.roots).toEqual(folders.slice(0, count).map((folder) => folder.root));
            expect(result.missing).toEqual([]);
        }
    });

    it("does not promote a nested configuration into a Forma workspace", async () => {
        expect(
            await discoverWorkspaceRoots([configuredWorkspace("/repo", undefined)], existing("/repo/nested/.forma.md")),
        ).toEqual({ roots: [], missing: [configuredWorkspace("/repo", undefined)] });
    });

    it("derives the workspace root from an explicit main configuration", () => {
        expect(configuredWorkspace("/repo", "docs/.forma.md")).toEqual({
            folderRoot: "/repo",
            configPath: "/repo/docs/.forma.md",
            configRelativePath: "docs/.forma.md",
            root: "/repo/docs",
        });
    });

    it("rejects unsafe or non-canonical main configuration paths", () => {
        expect(() => configuredWorkspace("/repo", "../.forma.md")).toThrow(/relative path/u);
        expect(() => configuredWorkspace("/repo", "/tmp/.forma.md")).toThrow(/relative path/u);
        expect(() => configuredWorkspace("/repo", "docs/forma.md")).toThrow(/named \.forma\.md/u);
        expect(() => configuredWorkspace("/repo", "docs\\.forma.md")).toThrow(/relative path/u);
    });

    it("returns POSIX workspace-relative paths", () => {
        expect(workspaceRelativePath("/repo", "/repo/notes/a.md")).toBe("notes/a.md");
        expect(workspaceRelativePath("/repo", "/outside/a.md")).toBeUndefined();
    });

    it("reuses the active runtime within one Forma root", () => {
        expect(shouldRefreshRuntimeForDocument(1, "/repo", "/repo")).toBe(false);
        expect(shouldRefreshRuntimeForDocument(2, "/repo", "/other")).toBe(true);
        expect(shouldRefreshRuntimeForDocument(0, undefined, undefined)).toBe(true);
        expect(shouldRefreshRuntimeForDocument(1, "/repo", undefined)).toBe(true);
    });

    it("derives content and configuration scope from config inspection", () => {
        expect(
            workspaceScopeFromConfig({
                schemaVersion: 1,
                operation: "config.inspect",
                status: "passed",
                summary: { errors: 0, warnings: 0, infos: 0 },
                workspace: { name: "Forma", root: "." },
                config: {
                    spaces: {
                        notes: { include: "notes/**/*.md", includePatterns: ["notes/**/*.md"] },
                        workspace: { includePatterns: ["workspace/*/index.md"] },
                    },
                    terms: {
                        topics: {
                            performance: { includePatterns: ["research/performance/**/*.md"] },
                        },
                    },
                },
                sources: [
                    { path: ".forma.md", present: true },
                    { path: ".forma/views/board.md", present: true },
                    { path: ".forma/views/board.md", present: true },
                ],
                sourcePatterns: [".forma/spaces/*.md", ".forma/views/*.md"],
            }),
        ).toEqual({
            configPatterns: [".forma/spaces/*.md", ".forma/views/*.md"],
            includePatterns: ["notes/**/*.md", "research/performance/**/*.md", "workspace/*/index.md"],
            configSourcePaths: [".forma.md", ".forma/views/board.md"],
        });
    });
});
