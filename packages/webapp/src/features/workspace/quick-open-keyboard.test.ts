import { describe, expect, it } from "vitest";

import { getQuickOpenActiveIndex, isQuickOpenComposing } from "./QuickOpenDialog";

describe("Quick Open keyboard behavior", () => {
    it("does not activate results while input method composition is in progress", () => {
        expect(isQuickOpenComposing({ isComposing: true, keyCode: 13 })).toBe(true);
        expect(isQuickOpenComposing({ isComposing: false, keyCode: 229 })).toBe(true);
        expect(isQuickOpenComposing({ isComposing: false, keyCode: 13 })).toBe(false);
    });

    it("moves within result boundaries and supports Home and End", () => {
        expect(getQuickOpenActiveIndex("ArrowDown", 0, 3)).toBe(1);
        expect(getQuickOpenActiveIndex("ArrowDown", 2, 3)).toBe(2);
        expect(getQuickOpenActiveIndex("ArrowUp", 0, 3)).toBe(0);
        expect(getQuickOpenActiveIndex("Home", 2, 3)).toBe(0);
        expect(getQuickOpenActiveIndex("End", 0, 3)).toBe(2);
    });

    it("leaves unrelated keys to native input behavior", () => {
        expect(getQuickOpenActiveIndex("Tab", 1, 3)).toBeUndefined();
        expect(getQuickOpenActiveIndex("Enter", 1, 3)).toBeUndefined();
    });
});
