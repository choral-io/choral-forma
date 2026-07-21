import { describe, expect, it } from "vitest";

import { editorUriToProtocol, protocolUriToEditor } from "./lsp-uri.ts";

describe("Forma LSP URI conversion", () => {
    it("preserves local file URIs and external targets", () => {
        const root = "file:///Users/tiscs/repo";
        expect(editorUriToProtocol("file:///Users/tiscs/repo/notes/a.md", root)).toBe(
            "file:///Users/tiscs/repo/notes/a.md",
        );
        expect(protocolUriToEditor("https://forma.choral.io/guide", root)).toBe("https://forma.choral.io/guide");
    });

    it("round-trips vscode-remote documents without leaking local paths", () => {
        const root = "vscode-remote://ssh-remote%2Bexample/home/tiscs/my%20repo";
        const editor = `${root}/notes/%E4%B8%AD%E6%96%87.md`;
        const protocol = editorUriToProtocol(editor, root);
        expect(protocol).toBe("file:///home/tiscs/my%20repo/notes/%E4%B8%AD%E6%96%87.md");
        expect(protocolUriToEditor(`${protocol}#L4:2`, root)).toBe(`${editor}#L4:2`);
        expect(editorUriToProtocol("file:///home/tiscs/my%20repo", root)).toBe("file:///home/tiscs/my%20repo");
    });

    it("uses the same root-bounded conversion for SSH, Dev Container, and WSL authorities", () => {
        for (const authority of ["ssh-remote%2Bexample", "dev-container%2Bworkspace", "wsl%2BUbuntu"]) {
            const root = `vscode-remote://${authority}/workspaces/forma`;
            const editor = `${root}/notes/page.md`;
            const protocol = editorUriToProtocol(editor, root);
            expect(protocol).toBe("file:///workspaces/forma/notes/page.md");
            expect(protocolUriToEditor(protocol, root)).toBe(editor);
        }
    });

    it("rejects cross-authority and out-of-root paths", () => {
        const root = "vscode-remote://ssh-remote%2Bexample/home/tiscs/repo";
        expect(() => editorUriToProtocol("vscode-remote://ssh-remote%2Bother/home/tiscs/repo/a.md", root)).toThrow(
            /outside/u,
        );
        expect(() => protocolUriToEditor("file:///home/tiscs/other/a.md", root)).toThrow(/outside/u);
        expect(() =>
            editorUriToProtocol("vscode-remote://ssh-remote%2Bexample/home/tiscs/repository/a.md", root),
        ).toThrow(/outside/u);
        expect(() => editorUriToProtocol("vscode-vfs://github/repo/a.md", root)).toThrow(/outside/u);
    });
});
