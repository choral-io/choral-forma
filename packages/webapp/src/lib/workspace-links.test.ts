import { describe, expect, it } from "vitest";

import { isExternalHref, normalizeWorkspaceHref } from "./workspace-links";

const entries = [
    { path: "notes/source.md" },
    { path: "notes/target.md" },
    { path: "tasks/review-reference-indexing.md" },
    { path: "concepts/repository-backed-knowledge.md" },
    { path: "assets/markdown-hero.png" },
];

describe("isExternalHref", () => {
    it("detects protocol-based external links", () => {
        expect(isExternalHref("https://example.com")).toBe(true);
        expect(isExternalHref("mailto:user@example.com")).toBe(true);
        expect(isExternalHref("./notes/target.md")).toBe(false);
        expect(isExternalHref("#section")).toBe(false);
    });
});

describe("normalizeWorkspaceHref", () => {
    it("keeps direct workspace paths and hash fragments", () => {
        expect(normalizeWorkspaceHref("./notes/target.md#context", "notes/source.md", entries)).toEqual({
            hash: "#context",
            path: "notes/target.md",
        });
    });

    it("resolves relative paths from the current entry directory", () => {
        expect(normalizeWorkspaceHref("../tasks/review-reference-indexing.md", "notes/source.md", entries)).toEqual({
            hash: "",
            path: "tasks/review-reference-indexing.md",
        });
    });

    it("resolves image paths through the same workspace path rules", () => {
        expect(normalizeWorkspaceHref("../assets/markdown-hero.png", "notes/source.md", entries)).toEqual({
            hash: "",
            path: "assets/markdown-hero.png",
        });
    });

    it("resolves a unique bare wikilink target by managed-entry basename", () => {
        expect(normalizeWorkspaceHref("repository-backed-knowledge.md#goal", "product/forma.md", entries)).toEqual({
            hash: "#goal",
            path: "concepts/repository-backed-knowledge.md",
        });
    });

    it("keeps ambiguous bare targets relative to the current entry", () => {
        expect(
            normalizeWorkspaceHref("target.md", "product/forma.md", [...entries, { path: "archive/target.md" }]),
        ).toEqual({
            hash: "",
            path: "product/target.md",
        });
    });
});
