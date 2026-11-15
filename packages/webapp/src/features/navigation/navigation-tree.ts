import type { DashboardView, DisplayOptions } from "@/data/workspace-client";

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
    /** Configured icon and color hints, for nodes that come from configuration. */
    display?: DisplayOptions;
    children?: NavigationNode[];
}

/** Ids of the branches that contain the first node routed to `routePath`, outermost first. */
export function navigationAncestorIds(nodes: readonly NavigationNode[], routePath: string): string[] | undefined {
    for (const node of nodes) {
        if (node.to === routePath) return [];
        if (!node.children) continue;
        const nested = navigationAncestorIds(node.children, routePath);
        if (nested) return [node.id, ...nested];
    }
    return undefined;
}

/**
 * Ids of the branches to open on arriving at `routePath`: only those that contain its node.
 * A destination that is itself a branch, such as a directory or a taxonomy, stays as the
 * reader left it, so following a link never also expands or collapses it.
 */
export function navigationRevealIds(nodes: readonly NavigationNode[], routePath: string): string[] {
    return navigationAncestorIds(nodes, routePath) ?? [];
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
