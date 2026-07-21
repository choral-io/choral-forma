import { describe, expect, it } from "vitest";

import { relativePreviewHref } from "./preview-links.ts";

describe("native Markdown preview links", () => {
    it("resolves workspace paths relative to the rendered View source", () => {
        expect(relativePreviewHref(".forma/views/graph.md", ".forma/views/graph.md")).toBe("./graph.md");
        expect(relativePreviewHref(".forma/views/graph.md", "members/sam-rivera.md")).toBe(
            "../../members/sam-rivera.md",
        );
    });

    it("encodes individual path segments without losing directory traversal", () => {
        expect(relativePreviewHref(".forma/views/graph.md", "members/Sam Rivera.md")).toBe(
            "../../members/Sam%20Rivera.md",
        );
    });
});
