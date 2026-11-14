import { describe, expect, it } from "vitest";

import {
    canonicalEntries,
    canonicalEntryFor,
    canonicalEntryRoutePath,
    entryLanguageVersions,
    languageVariantPaths,
} from "./entry-languages";

const variant = {
    language: "zh-Hans",
    path: "notes/getting-started.zh-hans.md",
    routePath: "/pages/notes/getting-started.zh-hans",
    rawPath: "/raw/notes/getting-started.zh-hans.md",
};
const canonical = { path: "notes/getting-started.md", routePath: "/pages/notes/getting-started", variants: [variant] };
// The read model may also list a variant as an entry of its own.
const variantEntry = { path: variant.path, routePath: variant.routePath, variants: [] };
const plain = { path: "notes/other.md", routePath: "/pages/notes/other", variants: [] };
const entries = [canonical, variantEntry, plain];

describe("entry languages", () => {
    it("keeps one entry per document", () => {
        expect(languageVariantPaths(entries)).toEqual(new Set([variant.path]));
        expect(canonicalEntries(entries)).toEqual([canonical, plain]);
    });

    it("maps a variant to the document it belongs to", () => {
        expect(canonicalEntryRoutePath(entries, variant.routePath)).toBe(canonical.routePath);
        expect(canonicalEntryRoutePath(entries, plain.routePath)).toBe(plain.routePath);
        expect(canonicalEntryFor(entries, variant.path)).toBe(canonical);
        expect(canonicalEntryFor(entries, plain.path)).toBe(plain);
    });

    it("offers the same versions from the canonical page and from a variant", () => {
        expect(entryLanguageVersions(entries, canonical)).toEqual([
            { current: true, language: "en", routePath: canonical.routePath },
            { current: false, language: "zh-Hans", routePath: variant.routePath },
        ]);
        expect(entryLanguageVersions(entries, variantEntry, "fr")).toEqual([
            { current: false, language: "fr", routePath: canonical.routePath },
            { current: true, language: "zh-Hans", routePath: variant.routePath },
        ]);
    });

    it("reports a single version for a document without variants", () => {
        expect(entryLanguageVersions(entries, plain)).toEqual([
            { current: true, language: "en", routePath: plain.routePath },
        ]);
    });
});
