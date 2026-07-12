import { describe, expect, it } from "vitest";

import { isFormaViewDocument } from "./view-document.ts";

describe("Forma View document detection", () => {
    it("uses Forma metadata kind instead of the content mount", () => {
        expect(isFormaViewDocument("markdown", "view")).toBe(true);
        expect(isFormaViewDocument("markdown", "note")).toBe(false);
    });

    it("rejects non-Markdown documents even when Forma reports a view", () => {
        expect(isFormaViewDocument("plaintext", "view")).toBe(false);
        expect(isFormaViewDocument(undefined, undefined)).toBe(false);
    });
});
