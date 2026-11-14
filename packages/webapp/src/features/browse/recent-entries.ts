import type { DashboardEntry } from "@/data/workspace-client";

/**
 * The most recently updated entries, newest first. Entries without a usable date
 * are left out, and ties keep their read-model order.
 */
export function recentlyUpdatedEntries(entries: readonly DashboardEntry[], limit: number, excludePath?: string) {
    return entries
        .map((entry, index) => ({ entry, index, updated: entry.updatedAt ? Date.parse(entry.updatedAt) : Number.NaN }))
        .filter((item) => !Number.isNaN(item.updated) && item.entry.path !== excludePath)
        .sort((left, right) => right.updated - left.updated || left.index - right.index)
        .slice(0, limit)
        .map((item) => item.entry);
}
