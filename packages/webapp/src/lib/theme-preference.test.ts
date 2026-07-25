// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { applyThemePreference, getNextThemePreference, themePreferenceChangeEvent } from "./theme-preference";

describe("getNextThemePreference", () => {
    it("cycles through system, light, and dark preferences", () => {
        expect(getNextThemePreference("system")).toBe("choral-light");
        expect(getNextThemePreference("choral-light")).toBe("choral-dark");
        expect(getNextThemePreference("choral-dark")).toBe("system");
    });
});

describe("applyThemePreference", () => {
    afterEach(() => {
        delete document.documentElement.dataset.theme;
        window.localStorage.clear();
    });

    it("announces Forma theme updates after applying semantic CSS state", () => {
        const onThemeChange = vi.fn();
        window.addEventListener(themePreferenceChangeEvent, onThemeChange);

        applyThemePreference("choral-dark", false);

        expect(document.documentElement.dataset.theme).toBe("choral-dark");
        expect(onThemeChange).toHaveBeenCalledOnce();
        window.removeEventListener(themePreferenceChangeEvent, onThemeChange);
    });
});
