import { describe, expect, it } from "vitest";

import { syncKanbanStickyRailScroll } from "./kanban-sticky-header";

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
});
