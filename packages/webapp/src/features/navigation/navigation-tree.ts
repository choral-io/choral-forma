import type { DashboardView, DisplayOptions } from "@/data/workspace-client";

import { compareText } from "./directory-listing";

export type NavigationNodeKind = "home" | "directory" | "entry" | "taxonomy" | "term" | "views" | "view";

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
    /**
     * What tells this node apart from siblings with the same label: a file or directory name,
     * or a configured id. It is shown, as `description`, only when a sibling shares the label.
     */
    name?: string;
    /** Set when a sibling shares this node's label; see `name`. */
    description?: string;
    /** Source path of the document this node opens, for a document or a directory a document stands for. */
    documentPath?: string;
    /** The directories a compacted directory row spans, outermost first, each with its own page. */
    segments?: NavigationSegment[];
    children?: NavigationNode[];
}

export interface NavigationSegment {
    label: string;
    /** Directory path up to and including this segment. */
    path: string;
    to: string;
}

/** Whether `routePath` opens this node, or one of the directories a compacted row spans. */
export function navigationNodeMatches(node: NavigationNode, routePath: string) {
    return node.to === routePath || (node.segments?.some((segment) => segment.to === routePath) ?? false);
}

/**
 * Adds each node's `name` as its `description` where a sibling shows the same label, so
 * duplicate titles stay distinguishable without changing the titles themselves.
 */
export function describeDuplicateSiblings(nodes: readonly NavigationNode[]): NavigationNode[] {
    return nodes.map((node) => {
        const duplicate =
            node.name !== undefined &&
            nodes.some((other) => other !== node && compareText(other.label, node.label) === 0);
        const children = node.children ? describeDuplicateSiblings(node.children) : undefined;
        return {
            ...node,
            ...(duplicate ? { description: node.name } : {}),
            ...(children ? { children } : {}),
        };
    });
}

/** Ids of the branches that contain the first node routed to `routePath`, outermost first. */
export function navigationAncestorIds(nodes: readonly NavigationNode[], routePath: string): string[] | undefined {
    for (const node of nodes) {
        if (navigationNodeMatches(node, routePath)) return [];
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

/**
 * Branches that start expanded in the Workspace tree: every root, so taxonomies show their
 * terms and the Views group its Views.
 */
export function workspaceDefaultOpenIds(nodes: readonly NavigationNode[]): string[] {
    return nodes.filter((node) => node.children).map((node) => node.id);
}

/**
 * Branches that start expanded in the Files tree: none, unless the root holds a single
 * folder and nothing but Home besides, which only adds a level without a choice.
 */
export function filesDefaultOpenIds(nodes: readonly NavigationNode[]): string[] {
    const contents = nodes.filter((node) => node.kind !== "home");
    const [only] = contents;
    return contents.length === 1 && only?.kind === "directory" && only.children ? [only.id] : [];
}

/** The documents that precede and follow the first node routed to `routePath` among its siblings. */
export function navigationSiblings(
    nodes: readonly NavigationNode[],
    routePath: string,
): { previous?: NavigationNode; next?: NavigationNode } | undefined {
    const index = nodes.findIndex((node) => node.to === routePath);
    if (index >= 0) {
        const isDocument = (node: NavigationNode | undefined) => (node?.documentPath ? node : undefined);
        return { previous: isDocument(nodes[index - 1]), next: isDocument(nodes[index + 1]) };
    }
    for (const node of nodes) {
        if (!node.children) continue;
        const nested = navigationSiblings(node.children, routePath);
        if (nested) return nested;
    }
    return undefined;
}
