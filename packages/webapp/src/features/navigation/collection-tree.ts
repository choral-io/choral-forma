import type { DashboardTaxonomy, DashboardView } from "@/data/workspace-client";
import { taxonomyRoutePath, taxonomyTermRoutePath, viewRoutePath } from "@/lib/workspace-routes";

import type { NavigationNode } from "./navigation-tree";

/**
 * Configured taxonomies and their terms, in the read model's order, which follows each
 * node's display order and then its title. Terms list no entries: the term page does, so
 * a document keeps a single place in the sidebar.
 */
export function buildCollectionTree(taxonomies: readonly DashboardTaxonomy[]): NavigationNode[] {
    return taxonomies.map((taxonomy) => ({
        id: `taxonomy:${taxonomy.id}`,
        kind: "taxonomy",
        label: taxonomy.title,
        name: taxonomy.id,
        title: taxonomy.description || undefined,
        to: taxonomyRoutePath(taxonomy.id),
        display: taxonomy.display,
        children: taxonomy.terms.map((term) => ({
            id: `term:${taxonomy.id}/${term.id}`,
            kind: "term",
            label: term.title,
            name: term.id,
            title: term.description || undefined,
            to: taxonomyTermRoutePath(taxonomy.id, term.id),
            display: term.display,
        })),
    }));
}

/**
 * A `Views` group of the configured Views, in the read model's display order, or nothing
 * when no View is configured. It follows the taxonomies, as in the editor extension's tree.
 */
export function buildViewTree(views: readonly DashboardView[]): NavigationNode[] {
    if (views.length === 0) return [];
    return [
        {
            id: "views",
            kind: "views",
            label: "Views",
            to: "/views",
            children: views.map((view) => ({
                id: `view:${view.id}`,
                kind: "view",
                label: view.title,
                name: view.id,
                title: view.description || undefined,
                to: viewRoutePath(view.id),
                viewKind: view.kind,
            })),
        },
    ];
}

/**
 * Ids of the taxonomy and term rows whose terms include `entryPath`, so the sidebar can
 * point at where a document is classified without marking another row as the current page.
 */
export function collectionIdsContaining(taxonomies: readonly DashboardTaxonomy[], entryPath: string): Set<string> {
    const ids = new Set<string>();
    for (const taxonomy of taxonomies) {
        for (const term of taxonomy.terms) {
            if (!term.entries.some((entry) => entry.path === entryPath)) continue;
            ids.add(`taxonomy:${taxonomy.id}`);
            ids.add(`term:${taxonomy.id}/${term.id}`);
        }
    }
    return ids;
}
