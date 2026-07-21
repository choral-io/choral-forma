import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../media/preview.css", import.meta.url), "utf8");

function rule(selector: string): string {
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = css.indexOf("}", start);
    expect(end).toBeGreaterThan(start);
    return css.slice(start, end + 1);
}

describe("view preview layout contract", () => {
    it("keeps the page fluid while a dynamic kanban owns one single-row horizontal scroller", () => {
        const view = rule(".forma-view {");
        const kanban = rule(".forma-view .kanban {");
        const column = rule(".forma-view .kanban-column {");
        expect(view).toContain("max-width: 100%");
        expect(view).toContain("min-width: 0");
        expect(view).toContain("--forma-kanban-column-min:");
        expect(view).toContain("--forma-kanban-column-max:");
        expect(kanban).toContain("display: flex");
        expect(kanban).toContain("flex-wrap: nowrap");
        expect(kanban).toContain("overflow-x: auto");
        expect(kanban).toContain("position: relative");
        expect(column).toContain("flex: 1 0 var(--forma-kanban-column-min)");
        expect(column).toContain("min-width: var(--forma-kanban-column-min)");
        expect(column).toContain("max-width: var(--forma-kanban-column-max)");
        expect(css).not.toContain("grid-auto-columns");
        expect(css).not.toContain("min-width: 36rem");
        expect(css).not.toMatch(/repeat\(6\b/);
    });

    it("contains native Frontmatter tables on Forma-managed preview pages", () => {
        const frontmatter = rule(".forma-frontmatter table.frontmatter {");
        const cells = rule(".forma-frontmatter table.frontmatter th,\n.forma-frontmatter table.frontmatter td {");
        expect(frontmatter).toContain("width: 100%");
        expect(frontmatter).toContain("max-width: 100%");
        expect(frontmatter).toContain("table-layout: fixed");
        expect(cells).toContain("overflow-wrap: anywhere");
        expect(cells).toContain("word-break: break-word");
    });
});
