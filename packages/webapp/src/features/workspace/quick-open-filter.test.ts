import { describe, expect, it } from "vitest";

import { filterQuickOpenItems, type QuickOpenItem } from "./QuickOpenDialog";

const items: QuickOpenItem[] = [
    { href: "/", label: "Dashboard", meta: "route" },
    { href: "/pages/guide", label: "Workspace Guide", meta: "knowledge/guide.md" },
    { href: "/spaces/planning", label: "Planning", meta: "space" },
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
});
