import { describe, expect, it } from "vitest";

import { isExternalHref, normalizeWorkspaceHref } from "./workspace-links";

const documents = [
    { path: "notes/source.md" },
    { path: "notes/target.md" },
    { path: "todos/review-reference-indexing.md" },
    { path: "assets/markdown-fixture.svg" },
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
        expect(normalizeWorkspaceHref("./notes/target.md#context", "notes/source.md", documents)).toEqual({
            hash: "#context",
            path: "notes/target.md",
        });
    });

    it("resolves relative paths from the current document directory", () => {
        expect(normalizeWorkspaceHref("../todos/review-reference-indexing.md", "notes/source.md", documents)).toEqual({
            hash: "",
            path: "todos/review-reference-indexing.md",
        });
    });

    it("resolves image paths through the same workspace path rules", () => {
        expect(normalizeWorkspaceHref("../assets/markdown-fixture.svg", "notes/source.md", documents)).toEqual({
            hash: "",
            path: "assets/markdown-fixture.svg",
        });
    });
});
