import type { DashboardEntry } from "@/data/workspace-client";
import { directoryRoutePath } from "@/lib/workspace-routes";

import { compareText } from "./directory-listing";

import type { NavigationNode } from "./navigation-tree";

interface DirectoryDraft {
    directories: Map<string, DirectoryDraft>;
    entries: NavigationNode[];
    path: string;
}

/**
 * Groups entries by the directories in their source paths, from the workspace root. A
 * directory opens its page. A document served at a directory row's route, such as its
 * `index` file or a same-named file beside it, is represented by that row alone.
 */
export function buildFileTree(entries: readonly Pick<DashboardEntry, "path" | "routePath" | "title">[]) {
    const root: DirectoryDraft = { directories: new Map(), entries: [], path: "" };

    for (const entry of entries) {
        const segments = entry.path.split("/").filter((segment) => segment.length > 0);
        let directory = root;
        for (const segment of segments.slice(0, -1)) {
            let child = directory.directories.get(segment);
            if (!child) {
                child = {
                    directories: new Map(),
                    entries: [],
                    path: directory.path ? `${directory.path}/${segment}` : segment,
                };
                directory.directories.set(segment, child);
            }
            directory = child;
        }
        directory.entries.push({
            id: `entry:${entry.path}`,
            kind: "entry",
            label: entry.title,
            title: entry.path,
            to: entry.routePath,
        });
    }

    const tree = directoryChildren(root);
    return withoutDirectoryRoutes(tree, new Set(directoryRoutes(tree)));
}

function directoryRoutes(nodes: readonly NavigationNode[]): string[] {
    return nodes.flatMap((node) =>
        node.kind === "directory" && node.to ? [node.to, ...directoryRoutes(node.children ?? [])] : [],
    );
}

/**
 * Drops documents that a directory row already stands for. A directory left with nothing
 * else, such as one holding only its `index` file, becomes a plain link with no disclosure.
 */
function withoutDirectoryRoutes(nodes: readonly NavigationNode[], routes: ReadonlySet<string>): NavigationNode[] {
    return nodes
        .filter((node) => node.kind !== "entry" || !node.to || !routes.has(node.to))
        .map((node) => {
            if (!node.children) return node;
            const children = withoutDirectoryRoutes(node.children, routes);
            if (children.length > 0) return { ...node, children };
            const { children: _omitted, ...leaf } = node;
            return leaf;
        });
}

function directoryChildren(directory: DirectoryDraft): NavigationNode[] {
    const directories = [...directory.directories].map(([name, child]) => directoryNode(name, child));
    return [...directories.sort(compareLabels), ...directory.entries.sort(compareLabels)];
}

function directoryNode(name: string, directory: DirectoryDraft): NavigationNode {
    // A directory that holds nothing but one directory adds a level without a choice, so the chain reads as one row.
    let label = name;
    let current = directory;
    while (current.entries.length === 0 && current.directories.size === 1) {
        const [[childName, child]] = [...current.directories] as [[string, DirectoryDraft]];
        label = `${label}/${childName}`;
        current = child;
    }
    return {
        id: `directory:${current.path}`,
        kind: "directory",
        label,
        title: current.path,
        to: directoryRoutePath(current.path),
        children: directoryChildren(current),
    };
}

function compareLabels(left: NavigationNode, right: NavigationNode) {
    return compareText(left.label, right.label);
}
