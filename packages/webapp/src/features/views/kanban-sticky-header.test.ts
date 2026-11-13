import { describe, expect, it } from "vitest";

import { syncKanbanStickyRailGeometry, syncKanbanStickyRailScroll } from "./kanban-sticky-header";

describe("Kanban sticky header", () => {
    it("mirrors the board horizontal position into the presentation rail", () => {
        const stickyRail = { scrollLeft: 0 };

        syncKanbanStickyRailScroll(stickyRail, 240);

        expect(stickyRail.scrollLeft).toBe(240);
    });

    it("ignores a board scroll after the presentation rail unmounts", () => {
        expect(() => {
            syncKanbanStickyRailScroll(null, 240);
        }).not.toThrow();
    });

    it("tracks every real semantic header box without a separate height model", () => {
        let sourceHeights = [48, 72, 96];
        const properties = sourceHeights.map(() => new Map<string, string>());
        const stickyRail = {
            scrollLeft: 0,
        };
        const sources = sourceHeights.map((_, index) => ({
            getBoundingClientRect: () => ({ height: sourceHeights[index] ?? 0 }),
        }));
        const stickyColumns = properties.map((columnProperties) => ({
            style: {
                setProperty(name: string, value: string) {
                    columnProperties.set(name, value);
                },
            },
        }));

        syncKanbanStickyRailGeometry({ scrollLeft: 180, sources, stickyColumns, stickyRail });

        expect(stickyRail.scrollLeft).toBe(180);
        expect(properties.map((columnProperties) => columnProperties.get("height"))).toEqual(["48px", "72px", "96px"]);

        sourceHeights = [96, 48, 120];
        syncKanbanStickyRailGeometry({ scrollLeft: 180, sources, stickyColumns, stickyRail });

        expect(properties.map((columnProperties) => columnProperties.get("height"))).toEqual(["96px", "48px", "120px"]);
    });
});
