import { describe, expect, it } from "vitest";

import { entrySupportedLanguages, formatEntrySupportedLanguages } from "./entry-languages";

describe("entrySupportedLanguages", () => {
    it("lists the canonical page language followed by available variants", () => {
        const entry = {
            variants: [
                {
                    language: "zh-Hans",
                    path: "notes/getting-started.zh-hans.md",
                    routePath: "/pages/notes/getting-started.zh-hans",
                    rawPath: "/raw/notes/getting-started.zh-hans.md",
                },
            ],
        };

        expect(entrySupportedLanguages(entry)).toEqual(["en", "zh-Hans"]);
        expect(formatEntrySupportedLanguages(entry)).toBe("en, zh-Hans");
    });
});
