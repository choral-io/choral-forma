import { useMemo } from "react";

import type { WorkspaceDashboard } from "@/data/workspace-client";

import { buildCollectionTree } from "./collection-tree";
import { buildFileTree } from "./file-tree";
import { useNavigationStrategy } from "./use-navigation-strategy";

/** The navigation tree for the reader's current strategy, shared by the sidebar and the reader. */
export function useNavigationTree(dashboard: WorkspaceDashboard) {
    const [strategy, setStrategy] = useNavigationStrategy();
    const fileTree = useMemo(() => buildFileTree(dashboard.entries), [dashboard.entries]);
    const collectionTree = useMemo(() => buildCollectionTree(dashboard), [dashboard]);

    return { setStrategy, strategy, tree: strategy === "files" ? fileTree : collectionTree };
}
