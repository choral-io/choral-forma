import type { DashboardView } from "@/data/workspace-client";

export type NavigationNodeKind = "directory" | "entry" | "taxonomy" | "term" | "views" | "view";

export interface NavigationNode {
    /** Unique within one tree. */
    id: string;
    kind: NavigationNodeKind;
    label: string;
    /** Tooltip for a label that hides detail, such as a document's source path. */
    title?: string;
    /** Route this node navigates to. A node without one only groups its children. */
    to?: string;
    viewKind?: DashboardView["kind"];
    children?: NavigationNode[];
}

/**
 * Ids of the branches that contain the first node routed to `routePath`, outermost
 * first. A document can appear under several branches; only the first is revealed.
 */
export function navigationAncestorIds(nodes: readonly NavigationNode[], routePath: string): string[] | undefined {
    for (const node of nodes) {
        if (node.to === routePath) return [];
        if (!node.children) continue;
        const nested = navigationAncestorIds(node.children, routePath);
        if (nested) return [node.id, ...nested];
    }
    return undefined;
}

/** The siblings that precede and follow the first node routed to `routePath`. */
export function navigationSiblings(
    nodes: readonly NavigationNode[],
    routePath: string,
): { previous?: NavigationNode; next?: NavigationNode } | undefined {
    const index = nodes.findIndex((node) => node.to === routePath);
    if (index >= 0) {
        const isDestination = (node: NavigationNode | undefined) => (node?.to && !node.children ? node : undefined);
        return { previous: isDestination(nodes[index - 1]), next: isDestination(nodes[index + 1]) };
    }
    for (const node of nodes) {
        if (!node.children) continue;
        const nested = navigationSiblings(node.children, routePath);
        if (nested) return nested;
    }
    return undefined;
}
