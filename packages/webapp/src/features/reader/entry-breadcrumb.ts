import type { DashboardTaxonomy } from "@/data/workspace-client";
import type { WorkspaceBreadcrumb } from "@/features/workspace/WorkspaceRouteFrame";
import { taxonomyRoutePath, taxonomyTermRoutePath } from "@/lib/workspace-routes";

/**
 * The directories that contain an entry, outermost first. Directories only group
 * entries, so none of them is a destination.
 */
export function entryDirectoryBreadcrumb(path: string): WorkspaceBreadcrumb[] {
    return path
        .split("/")
        .slice(0, -1)
        .filter((segment) => segment.length > 0)
        .map((label) => ({ label }));
}

/**
 * The first configured taxonomy and term that contain an entry, matching the branch
 * the Collections tree reveals for it. An entry outside every term has no crumbs.
 */
export function entryCollectionBreadcrumb(
    taxonomies: readonly DashboardTaxonomy[],
    entryPath: string,
): WorkspaceBreadcrumb[] {
    for (const taxonomy of taxonomies) {
        const term = taxonomy.terms.find((candidate) => candidate.entries.some((entry) => entry.path === entryPath));
        if (!term) continue;
        return [
            { label: taxonomy.title, to: taxonomyRoutePath(taxonomy.id) },
            { label: term.title, to: taxonomyTermRoutePath(taxonomy.id, term.id) },
        ];
    }
    return [];
}
