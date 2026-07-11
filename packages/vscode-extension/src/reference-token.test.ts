import { describe, expect, it } from "vitest";

import { referenceTokenAt, scanReferenceTokens } from "./reference-token.ts";

describe("reference tokens", () => {
    it("recognizes Markdown links, wikilinks, aliases, fragments, and embeds", () => {
        const text = "[Guide](docs/guide.md#Start) [[members/tiscs|Tiscs]] ![[assets/map#^block]]";
        expect(scanReferenceTokens(text)).toMatchObject([
            { target: "docs/guide.md", fragment: "Start", intent: "link", syntax: "markdown" },
            { target: "members/tiscs", intent: "link", syntax: "wikilink" },
            { target: "assets/map", fragment: "^block", intent: "embed", syntax: "wikilink" },
        ]);
    });

    it("ignores external Markdown links", () => {
        expect(scanReferenceTokens("[Forma](https://example.com) [Local](note.md)")).toHaveLength(1);
    });

    it("decodes escaped Markdown paths and fragments", () => {
        expect(scanReferenceTokens("[Guide](docs/My%20Guide.md#Getting%20Started)")[0]).toMatchObject({
            target: "docs/My Guide.md",
            fragment: "Getting Started",
        });
        expect(scanReferenceTokens("[Guide](<docs/My Guide.md#Details>)")[0]).toMatchObject({
            target: "docs/My Guide.md",
            fragment: "Details",
        });
    });

    it("recognizes a semantic frontmatter token under the cursor", () => {
        const text = "---\nowner: members/tiscs\n---\n";
        const offset = text.indexOf("tiscs");
        expect(referenceTokenAt(text, offset)).toMatchObject({ target: "members/tiscs", intent: "reference" });
    });
});
