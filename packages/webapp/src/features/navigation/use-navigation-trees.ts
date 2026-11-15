import { useMemo } from "react";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { canonicalEntries } from "@/lib/entry-languages";

import { buildCollectionTree, buildViewTree } from "./collection-tree";
import { buildFileTree } from "./file-tree";

/**
 * The sidebar's trees, shared by the sidebar and the reader. Pages lists one entry per
 * document; language variants are reached from the document itself.
 */
export function useNavigationTrees(dashboard: WorkspaceDashboard) {
    const pages = useMemo(() => buildFileTree(canonicalEntries(dashboard.entries)), [dashboard.entries]);
    // Configuration-derived navigation: taxonomies and their terms, then the Views group.
    const workspace = useMemo(
        () => [...buildCollectionTree(dashboard.taxonomies), ...buildViewTree(dashboard.views)],
        [dashboard.taxonomies, dashboard.views],
    );
    return { pages, workspace };
}
