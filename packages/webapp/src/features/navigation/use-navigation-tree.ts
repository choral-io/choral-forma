import { useMemo } from "react";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { canonicalEntries, languageVariantPaths } from "@/lib/entry-languages";

import { buildCollectionTree } from "./collection-tree";
import { buildFileTree } from "./file-tree";
import { useNavigationStrategy } from "./use-navigation-strategy";

/**
 * The navigation tree for the reader's current strategy, shared by the sidebar and the reader.
 * Both strategies list one entry per document; language variants are reached from the document itself.
 */
export function useNavigationTree(dashboard: WorkspaceDashboard) {
    const [strategy, setStrategy] = useNavigationStrategy();
    const fileTree = useMemo(() => buildFileTree(canonicalEntries(dashboard.entries)), [dashboard.entries]);
    const collectionTree = useMemo(
        () => buildCollectionTree(dashboard, languageVariantPaths(dashboard.entries)),
        [dashboard],
    );

    return { setStrategy, strategy, tree: strategy === "files" ? fileTree : collectionTree };
}
