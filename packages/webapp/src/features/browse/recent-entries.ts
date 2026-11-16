import type { DashboardEntry } from "@/data/workspace-client";
import { isSystemRoutePath } from "@/lib/workspace-routes";

/**
 * The most recently updated entries, newest first. Entries without a usable date, or
 * inside the reserved route segment, are left out, and ties keep their read-model order.
 */
export function recentlyUpdatedEntries(entries: readonly DashboardEntry[], limit: number, excludePath?: string) {
    return entries
        .map((entry, index) => ({ entry, index, updated: entry.updatedAt ? Date.parse(entry.updatedAt) : Number.NaN }))
        .filter(
            (item) =>
                !Number.isNaN(item.updated) &&
                item.entry.path !== excludePath &&
                !isSystemRoutePath(item.entry.routePath),
        )
        .sort((left, right) => right.updated - left.updated || left.index - right.index)
        .slice(0, limit)
        .map((item) => item.entry);
}
