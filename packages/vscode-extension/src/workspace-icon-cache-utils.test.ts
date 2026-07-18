import { describe, expect, it } from "vitest";

import {
    colorizeBundledLucideSvg,
    configuredIconColor,
    presentationIconCacheName,
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

    it("uses an opaque digest filename with no user-controlled path segments", () => {
        const name = presentationIconCacheName("folder-tree", "#4f7cac");
        expect(name).toMatch(/^[0-9a-f]{64}\.svg$/u);
        expect(name).toBe(presentationIconCacheName("folder-tree", "#4f7cac"));
        expect(name).not.toBe(presentationIconCacheName("folder-tree", "#64748b"));
    });

    it("falls back to theme assets in high contrast themes", () => {
        expect(configuredIconColor("#4F7CAC", false)).toBe("#4f7cac");
        expect(configuredIconColor("#4F7CAC", true)).toBeUndefined();
        expect(configuredIconColor("red", false)).toBeUndefined();
    });
});
