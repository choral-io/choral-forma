import type { DashboardTaxonomy, DashboardView } from "@/data/workspace-client";
import { taxonomyRoutePath, taxonomyTermRoutePath, viewRoutePath, viewsRoutePath } from "@/lib/workspace-routes";

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
            to: viewsRoutePath,
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

export interface EntryClassification {
    /** The taxonomy's id, unique among a document's classifications. */
    key: string;
    taxonomyTitle: string;
    /** The taxonomy's terms that include the document, in configured order. */
    terms: { key: string; title: string; to: string }[];
}

/**
 * The configured terms that include `entryPath`, grouped by taxonomy in the read model's order,
 * so a document can name where it is classified and link to each term. Taxonomies that do not
 * classify the document are left out.
 */
export function entryClassifications(
    taxonomies: readonly DashboardTaxonomy[],
    entryPath: string,
): EntryClassification[] {
    return taxonomies.flatMap((taxonomy) => {
        const terms = taxonomy.terms
            .filter((term) => term.entries.some((entry) => entry.path === entryPath))
            .map((term) => ({ key: term.id, title: term.title, to: taxonomyTermRoutePath(taxonomy.id, term.id) }));
        return terms.length > 0 ? [{ key: taxonomy.id, taxonomyTitle: taxonomy.title, terms }] : [];
    });
}
