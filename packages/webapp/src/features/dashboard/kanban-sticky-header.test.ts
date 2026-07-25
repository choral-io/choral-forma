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

    it("tracks the real semantic header box height without a separate height model", () => {
        let sourceHeight = 48;
        const properties = new Map<string, string>();
        const stickyRail = {
            scrollLeft: 0,
            style: {
                setProperty(name: string, value: string) {
                    properties.set(name, value);
                },
            },
        };
        const source = {
            getBoundingClientRect: () => ({ height: sourceHeight }),
        };

        syncKanbanStickyRailGeometry({ scrollLeft: 180, source, stickyRail });

        expect(stickyRail.scrollLeft).toBe(180);
        expect(properties.get("--view-kanban-heading-height")).toBe("48px");

        sourceHeight = 64;
        syncKanbanStickyRailGeometry({ scrollLeft: 180, source, stickyRail });

        expect(properties.get("--view-kanban-heading-height")).toBe("64px");
    });
});
