import type { WorkspaceDashboard } from "@/data/workspace-client";
import { taxonomyRoutePath, taxonomyTermRoutePath, viewRoutePath } from "@/lib/workspace-routes";

import type { NavigationNode } from "./navigation-tree";

/**
 * Configured taxonomies, their terms, and each term's entries, followed by the
 * configured Views. Order and titles come from configuration as the read model reports them.
 * Entries whose paths are in `omittedPaths`, such as language variants, are left out.
 */
export function buildCollectionTree(
    dashboard: Pick<WorkspaceDashboard, "taxonomies" | "views">,
    omittedPaths: ReadonlySet<string> = new Set(),
): NavigationNode[] {
    const taxonomies = dashboard.taxonomies.map((taxonomy): NavigationNode => ({
        id: `taxonomy:${taxonomy.id}`,
        kind: "taxonomy",
        label: taxonomy.title,
        to: taxonomyRoutePath(taxonomy.id),
        children: taxonomy.terms.map((term): NavigationNode => ({
            id: `term:${taxonomy.id}/${term.id}`,
            kind: "term",
            label: term.title,
            to: taxonomyTermRoutePath(taxonomy.id, term.id),
            children: term.entries
                .filter((entry) => !omittedPaths.has(entry.path))
                .map((entry): NavigationNode => ({
                    id: `term-entry:${taxonomy.id}/${term.id}/${entry.path}`,
                    kind: "entry",
                    label: entry.title,
                    title: entry.path,
                    to: entry.routePath,
                })),
        })),
    }));
    if (dashboard.views.length === 0) return taxonomies;

    return [
        ...taxonomies,
        {
            id: "views",
            kind: "views",
            label: "Views",
            to: "/views",
            children: dashboard.views.map((view): NavigationNode => ({
                id: `view:${view.id}`,
                kind: "view",
                label: view.title,
                title: view.description || undefined,
                to: viewRoutePath(view.id),
                viewKind: view.kind,
            })),
        },
    ];
}
