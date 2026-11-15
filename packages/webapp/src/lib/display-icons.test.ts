import { DISPLAY_ICON_IDS } from "@choral-forma/shared";
import { describe, expect, it } from "vitest";

import { displayColor, displayIconId, displayIcons } from "./display-icons";

describe("display icons", () => {
    it("bundles a glyph for every icon in Core's registry and nothing else", () => {
        expect(Object.keys(displayIcons).sort()).toEqual([...DISPLAY_ICON_IDS].sort());
    });

    it("falls back when the icon is missing or unsupported", () => {
        expect(displayIconId({ icon: "rocket" }, "tags")).toBe("rocket");
        expect(displayIconId({ icon: "https://example.test/icon.svg" }, "tags")).toBe("tags");
        expect(displayIconId({ icon: "constructor" }, "tags")).toBe("tags");
        expect(displayIconId(undefined, "tags")).toBe("tags");
    });

    it("accepts only Core's color form", () => {
        expect(displayColor({ color: "#4F7CAC" })).toBe("#4f7cac");
        expect(displayColor({ color: "red" })).toBeUndefined();
        expect(displayColor(undefined)).toBeUndefined();
    });
});
