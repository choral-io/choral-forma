import { describe, expect, it } from "vitest";

import type { DashboardEntry } from "@/data/workspace-client";

import { recentlyUpdatedEntries } from "./recent-entries";

const entry = (path: string, updatedAt?: string) =>
    ({ path, routePath: `/${path.replace(/\.md$/u, "")}`, updatedAt }) as DashboardEntry;

describe("recentlyUpdatedEntries", () => {
    const entries = [
        entry("old.md", "2026-01-01T00:00:00Z"),
        entry("undated.md"),
        entry("newest.md", "2026-03-01T08:00:00+08:00"),
        entry("tie-a.md", "2026-02-01T00:00:00Z"),
        entry("tie-b.md", "2026-02-01T00:00:00Z"),
        entry("invalid.md", "not a date"),
    ];

    it("orders by instant, keeps read-model order for ties, and drops undated entries", () => {
        expect(recentlyUpdatedEntries(entries, 10).map((item) => item.path)).toEqual([
            "newest.md",
            "tie-a.md",
            "tie-b.md",
            "old.md",
        ]);
    });

    it("leaves out documents inside the reserved route segment", () => {
        expect(
            recentlyUpdatedEntries([entry("-/browse.md", "2026-04-01T00:00:00Z"), ...entries], 1).map(
                (item) => item.path,
            ),
        ).toEqual(["newest.md"]);
    });

    it("applies the limit after excluding the given path", () => {
        expect(recentlyUpdatedEntries(entries, 2, "newest.md").map((item) => item.path)).toEqual([
            "tie-a.md",
            "tie-b.md",
        ]);
    });
});
