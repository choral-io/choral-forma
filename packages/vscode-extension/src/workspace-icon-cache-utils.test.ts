import { describe, expect, it } from "vitest";

import {
    colorizeBundledLucideSvg,
    configuredIconColor,
    svgDataUri,
    uniformThemeIconPath,
} from "./workspace-icon-cache-utils.ts";

describe("workspace icon cache utilities", () => {
    it("recolors only the trusted root Lucide stroke", () => {
        const source =
            '<svg xmlns="http://www.w3.org/2000/svg" stroke="#424242"><path stroke="#424242" d="M1 1" /></svg>';
        expect(colorizeBundledLucideSvg(source, "#4F7CAC")).toBe(
            '<svg xmlns="http://www.w3.org/2000/svg" stroke="#4f7cac"><path stroke="#424242" d="M1 1" /></svg>',
        );
    });

    it("rejects invalid colors and unexpected SVG input", () => {
        expect(() => colorizeBundledLucideSvg('<svg stroke="#424242" />', "red")).toThrow(/Invalid/u);
        expect(() => colorizeBundledLucideSvg('<svg stroke="currentColor" />', "#4f7cac")).toThrow(/unexpected/u);
    });

    it("falls back to theme assets in high contrast themes", () => {
        expect(configuredIconColor("#4F7CAC", false)).toBe("#4f7cac");
        expect(configuredIconColor("#4F7CAC", true)).toBeUndefined();
        expect(configuredIconColor("red", false)).toBeUndefined();
    });

    it("presents generated icons through both VS Code theme slots", () => {
        const uri = { path: "/generated/icon.svg" };
        expect(uniformThemeIconPath(uri)).toEqual({ light: uri, dark: uri });
    });

    it("keeps generated SVGs self-contained for local and remote extension hosts", () => {
        const source = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1" /></svg>';
        const uri = svgDataUri(source);
        expect(uri).toMatch(/^data:image\/svg\+xml;base64,/u);
        expect(Buffer.from(uri.split(",")[1] ?? "", "base64").toString("utf8")).toBe(source);
    });
});
