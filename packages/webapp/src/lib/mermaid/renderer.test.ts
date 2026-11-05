import { describe, expect, it } from "vitest";

import { renderMermaidSvg } from "./renderer";

const theme = {
    accent: "var(--color-primary)",
    bg: "var(--color-base-100)",
    border: "var(--color-base-300)",
    fg: "var(--color-base-content)",
    font: "system-ui",
    surface: "var(--color-base-200)",
    transparent: true,
};

describe("renderMermaidSvg", () => {
    it.each(["flowchart LR", "stateDiagram-v2", "sequenceDiagram", "classDiagram", "erDiagram"])(
        "renders an empty %s without losing the existing empty-diagram behavior",
        (header) => {
            const svg = renderMermaidSvg(`${header}\n%% Empty diagram`, theme);
            expect(svg).toContain('viewBox="0 0 0 0"');
            expect(svg).toContain('width="0"');
            expect(svg).not.toContain("<text");
        },
    );

    it("preserves CJK labels and authored horizontal direction", () => {
        const svg = renderMermaidSvg("flowchart LR\nA[中文标签] --> B[完成]", theme);
        expect(svg).toContain("中文标签");
        expect(svg).toContain("完成");
        expect(svg).toContain("pele-flowchart");
    });

    it("does not emit links from source directives", () => {
        const svg = renderMermaidSvg("flowchart LR\nA --> B\nclick A https://example.test", theme);
        expect(svg).not.toContain("href=");
    });
});
