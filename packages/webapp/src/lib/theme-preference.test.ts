import { describe, expect, it } from "vitest";

import { getNextThemePreference } from "./theme-preference";

describe("getNextThemePreference", () => {
    it("cycles through system, light, and dark preferences", () => {
        expect(getNextThemePreference("system")).toBe("choral-light");
        expect(getNextThemePreference("choral-light")).toBe("choral-dark");
        expect(getNextThemePreference("choral-dark")).toBe("system");
    });
});
