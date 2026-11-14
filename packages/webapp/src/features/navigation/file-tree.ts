import type { DashboardEntry } from "@/data/workspace-client";

import type { NavigationNode } from "./navigation-tree";

interface DirectoryDraft {
    directories: Map<string, DirectoryDraft>;
    entries: NavigationNode[];
    path: string;
}

/**
 * Groups entries by the directories in their source paths. Directories only group:
 * none is a destination, and no filename is treated as a directory landing page.
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

    return directoryChildren(root);
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
        children: directoryChildren(current),
    };
}

function compareLabels(left: NavigationNode, right: NavigationNode) {
    return left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: "base" });
}
