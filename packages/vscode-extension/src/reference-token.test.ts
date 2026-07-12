import { describe, expect, it } from "vitest";

import { referenceTokenAt, scanReferenceTokens, wikilinkDisplayLabel } from "./reference-token.ts";

describe("reference tokens", () => {
    it("recognizes Markdown links, wikilinks, aliases, fragments, and embeds", () => {
        const text = "[Guide](docs/guide.md#Start) [[members/tiscs|Tiscs]] ![[assets/map#^block]]";
        expect(scanReferenceTokens(text)).toMatchObject([
            { target: "docs/guide.md", fragment: "Start", intent: "link", syntax: "markdown" },
            {
                target: "members/tiscs",
                intent: "link",
                syntax: "wikilink",
                raw: "[[members/tiscs|Tiscs]]",
                label: "Tiscs",
                explicitLabel: true,
            },
            {
                target: "assets/map",
                fragment: "^block",
                intent: "embed",
                syntax: "wikilink",
                raw: "![[assets/map#^block]]",
                label: "assets/map#^block",
            },
        ]);
    });

    it("prefers an explicit alias, then the resolved title, then the source path", () => {
        const [plain, fragment, alias, untitled] = scanReferenceTokens(
            "[[releases/planning-beta]] [[docs/guide#Getting Started]] [[members/noah-kim|Noah]] [[missing/path]]",
        );
        expect(plain).toBeDefined();
        expect(fragment).toBeDefined();
        expect(alias).toBeDefined();
        expect(untitled).toBeDefined();
        if (!plain || !fragment || !alias || !untitled) return;

        expect(wikilinkDisplayLabel(plain, "Planning Beta")).toBe("Planning Beta");
        expect(wikilinkDisplayLabel(fragment, "Guide")).toBe("Guide › Getting Started");
        expect(wikilinkDisplayLabel(alias, "Noah Kim")).toBe("Noah");
        expect(wikilinkDisplayLabel(untitled, undefined)).toBe("missing/path");
    });

    it("ignores external Markdown links", () => {
        expect(scanReferenceTokens("[Forma](https://example.com) [Local](note.md)")).toHaveLength(1);
    });

    it("ignores references inside inline and fenced code", () => {
        const text = [
            "Visible [[docs/guide]]",
            "`[[inline/example]]`",
            "```md",
            "[[fenced/example]]",
            "[Fenced](fenced/markdown.md)",
            "```",
        ].join("\n");

        expect(scanReferenceTokens(text)).toMatchObject([{ target: "docs/guide", intent: "link", syntax: "wikilink" }]);
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
        expect(referenceTokenAt(text, offset)).toBeUndefined();
        expect(referenceTokenAt(text, offset, [{ field: "owner", value: "members/tiscs" }])).toMatchObject({
            target: "members/tiscs",
            intent: "reference",
        });
    });

    it("only treats Core-backed frontmatter values as references", () => {
        const text = "---\nowners:\n  - members/tiscs\n  - members/ava\ntags:\n  - vscode-extension\n---\n";
        const references = [
            { field: "owners", value: "members/tiscs", targetPath: "members/tiscs.md" },
            { field: "owners", value: "members/ava", targetPath: "members/ava.md" },
        ];

        expect(referenceTokenAt(text, text.indexOf("tiscs"), references)).toMatchObject({
            target: "members/tiscs",
            intent: "reference",
            syntax: "frontmatter",
        });
        expect(referenceTokenAt(text, text.indexOf("members/ava"), references)).toMatchObject({
            target: "members/ava",
            intent: "reference",
            syntax: "frontmatter",
        });
        expect(referenceTokenAt(text, text.indexOf("vscode-extension"), references)).toBeUndefined();
    });

    it("treats reference token offsets as an exclusive range", () => {
        const text = "See [[target]] next";
        const token = scanReferenceTokens(text)[0];
        expect(token).toBeDefined();
        if (!token) return;

        expect(referenceTokenAt(text, token.start)).toEqual(token);
        expect(referenceTokenAt(text, token.end - 1)).toEqual(token);
        expect(referenceTokenAt(text, token.end)).toBeUndefined();
    });
});
