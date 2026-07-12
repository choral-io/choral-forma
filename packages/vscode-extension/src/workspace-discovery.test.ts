import { describe, expect, it } from "vitest";

import {
    discoverWorkspaceRoots,
    findNearestWorkspaceRoot,
    selectWorkspaceRoot,
    shouldRefreshRuntimeForDocument,
    workspaceRelativePath,
} from "./workspace-discovery.ts";

const existing =
    (...paths: string[]) =>
    async (path: string): Promise<boolean> =>
        paths.includes(path);

describe("workspace discovery", () => {
    it("finds root and nearest nested configurations without escaping folder boundaries", async () => {
        expect(
            await findNearestWorkspaceRoot("/repo/nested/docs/note.md", "/repo", existing("/repo/nested/.forma.md")),
        ).toBe("/repo/nested");
        expect(await findNearestWorkspaceRoot("/other/note.md", "/repo", existing("/other/.forma.md"))).toBeUndefined();
    });

    it("discovers multi-root workspaces and selects the most specific root", async () => {
        const roots = await discoverWorkspaceRoots(
            ["/repo", "/other"],
            "/repo/nested/note.md",
            existing("/repo/.forma.md", "/repo/nested/.forma.md", "/other/.forma.md"),
        );
        expect(roots).toEqual(["/other", "/repo", "/repo/nested"]);
        expect(selectWorkspaceRoot(roots, "/repo/nested/note.md")).toBe("/repo/nested");
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
});
