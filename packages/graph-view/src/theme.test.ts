import { describe, expect, it } from "vitest";

import { createGraphThemeFromTokens, mixGraphColors, opaqueGraphColor } from "./theme.ts";

describe("Graph theme roles", () => {
    it("derives visible but quieter opaque roles from light Host tokens", () => {
        const theme = createGraphThemeFromTokens({
            background: "rgb(255, 255, 255)",
            surface: "rgb(255, 255, 255)",
            border: "rgba(0, 0, 0, 0.1)",
            foreground: "rgb(37, 37, 37)",
            mutedForeground: "rgb(115, 115, 115)",
            primary: "rgb(23, 117, 91)",
            accent: "rgb(3, 132, 199)",
            focusRing: "rgb(163, 163, 163)",
        });

        expect(theme.nodeMuted).toBe("rgb(216, 216, 216)");
        expect(theme.edgeMuted).toBe("rgb(230, 230, 230)");
        expect(theme.nodeMuted).not.toBe(theme.background);
        expect(theme.nodeSelected).toBe("rgb(23, 117, 91)");
    });

    it("keeps muted roles visible without becoming bright in dark themes", () => {
        const theme = createGraphThemeFromTokens({
            background: "rgb(37, 37, 37)",
            surface: "rgb(52, 52, 52)",
            border: "rgba(255, 255, 255, 0.1)",
            foreground: "rgb(250, 250, 250)",
            mutedForeground: "rgb(180, 180, 180)",
            primary: "rgb(28, 103, 82)",
            accent: "rgb(97, 199, 244)",
            focusRing: "rgb(180, 180, 180)",
        });

        expect(theme.border).toBe("rgb(59, 59, 59)");
        expect(theme.nodeMuted).toBe("rgb(77, 77, 77)");
        expect(theme.edgeMuted).toBe("rgb(63, 63, 63)");
        expect(theme.node).toBe("rgb(140, 140, 140)");
    });

    it("composites alpha before mixing and rejects no supported syntax", () => {
        expect(opaqueGraphColor("#000000", "rgba(255, 255, 255, 0.1)")).toBe("rgb(26, 26, 26)");
        expect(mixGraphColors("#000000", "#ffffff", 0.25)).toBe("rgb(64, 64, 64)");
    });
});
