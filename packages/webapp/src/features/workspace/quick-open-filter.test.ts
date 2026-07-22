import { describe, expect, it } from "vitest";

import { filterQuickOpenItems, type QuickOpenItem } from "./QuickOpenDialog";

const items: QuickOpenItem[] = [
    { group: "Navigate", href: "/", label: "Dashboard", meta: "route" },
    { group: "Pages", href: "/pages/guide", label: "Workspace Guide", meta: "knowledge/guide.md" },
    { group: "Spaces", href: "/spaces/planning", label: "Planning", meta: "1 page" },
];

describe("filterQuickOpenItems", () => {
    it("matches labels and metadata without case sensitivity", () => {
        expect(filterQuickOpenItems(items, "GUIDE")).toEqual([items[1]]);
        expect(filterQuickOpenItems(items, "knowledge")).toEqual([items[1]]);
    });

    it("returns the first items for an empty query and respects the result limit", () => {
        expect(filterQuickOpenItems(items, "", 2)).toEqual(items.slice(0, 2));
    });

    it("returns an empty list when nothing matches", () => {
        expect(filterQuickOpenItems(items, "missing")).toEqual([]);
    });

    it("ranks exact and prefix label matches ahead of metadata matches", () => {
        const ranked: QuickOpenItem[] = [
            { group: "Pages", href: "/pages/one", label: "Prepare Task Board", meta: "tasks/one.md" },
            { group: "Views", href: "/views/task-board", label: "Task Board", meta: "kanban" },
            { group: "Spaces", href: "/spaces/tasks", label: "Tasks", meta: "6 pages" },
        ];

        expect(filterQuickOpenItems(ranked, "task")).toEqual([ranked[1], ranked[2], ranked[0]]);
    });

    it("matches multiple query tokens across labels and metadata", () => {
        expect(filterQuickOpenItems(items, "workspace knowledge")).toEqual([items[1]]);
    });
});
