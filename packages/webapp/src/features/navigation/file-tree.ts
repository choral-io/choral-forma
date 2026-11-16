import type { DashboardEntry } from "@/data/workspace-client";
import { directoryRoutePath, isSystemRoutePath } from "@/lib/workspace-routes";

import { compareText } from "./directory-listing";
import { directoryOwners } from "./directory-owners";
import { describeDuplicateSiblings, type NavigationNode } from "./navigation-tree";

type FileTreeEntry = Pick<DashboardEntry, "path" | "routePath" | "title">;

interface DirectoryDraft {
    directories: Map<string, DirectoryDraft>;
    entries: NavigationNode[];
    path: string;
}

/**
 * Groups entries by the directories in their source paths, from the workspace root.
 *
 * - A directory opens its page. A document served at its route, such as its `index` file or
 *   a same-named file beside it, stands for the directory: the row takes the document's
 *   title and the document is not listed again.
 * - A chain of directories that each hold nothing but one directory reads as one row whose
 *   segments still open their own pages. A directory a document stands for never joins a
 *   chain, so a row shows either path segments or a title, not both.
 * - Siblings that share a label carry their file or directory name as a description.
 * - The workspace entry document, served at `/`, is the root's own document. It leads the
 *   tree ahead of every folder and takes no part in adjacent-document order.
 */
export function buildFileTree(allEntries: readonly FileTreeEntry[]): NavigationNode[] {
    // A document inside the reserved segment cannot be opened; Core reports it instead.
    const entries = allEntries.filter((entry) => !isSystemRoutePath(entry.routePath));
    const owners = directoryOwners(entries);
    const ownerPaths = new Set([...owners.values()].map((owner) => owner.path));
    const root: DirectoryDraft = { directories: new Map(), entries: [], path: "" };
    const home = entries.find((entry) => entry.routePath === "/");

    for (const entry of entries) {
        if (entry === home) continue;
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
        if (ownerPaths.has(entry.path)) continue;
        directory.entries.push({
            id: `entry:${entry.path}`,
            kind: "entry",
            label: entry.title,
            name: segments.at(-1) ?? entry.path,
            title: entry.path,
            to: entry.routePath,
            documentPath: entry.path,
        });
    }

    const homeNode: NavigationNode[] = home
        ? [{ id: "home", kind: "home", label: home.title, title: home.path, to: "/" }]
        : [];
    return describeDuplicateSiblings([...homeNode, ...directoryChildren(root, owners)]);
}

function directoryChildren(directory: DirectoryDraft, owners: ReadonlyMap<string, FileTreeEntry>): NavigationNode[] {
    const directories = [...directory.directories].map(([name, child]) => directoryNode(name, child, owners));
    return [...directories.sort(compareNodes), ...directory.entries.sort(compareNodes)];
}

function directoryNode(
    name: string,
    directory: DirectoryDraft,
    owners: ReadonlyMap<string, FileTreeEntry>,
): NavigationNode {
    const segments = [{ label: name, path: directory.path }];
    let current = directory;
    while (!owners.has(current.path) && current.entries.length === 0 && current.directories.size === 1) {
        const [[childName, child]] = [...current.directories] as [[string, DirectoryDraft]];
        if (owners.has(child.path)) break;
        segments.push({ label: childName, path: child.path });
        current = child;
    }

    const owner = owners.get(current.path);
    const relativePath = segments.map((segment) => segment.label).join("/");
    const children = directoryChildren(current, owners);
    return {
        id: `directory:${current.path}`,
        kind: "directory",
        label: owner?.title ?? relativePath,
        name: `${relativePath}/`,
        title: current.path,
        to: directoryRoutePath(current.path),
        ...(owner ? { documentPath: owner.path } : {}),
        ...(segments.length > 1
            ? { segments: segments.map((segment) => ({ ...segment, to: directoryRoutePath(segment.path) })) }
            : {}),
        // A directory whose document is all it holds is a plain link with no disclosure.
        ...(children.length > 0 ? { children } : {}),
    };
}

/** Siblings sort by displayed text; equal labels fall back to their names, so the order is stable. */
function compareNodes(left: NavigationNode, right: NavigationNode) {
    return compareText(left.label, right.label) || compareText(left.name ?? "", right.name ?? "");
}
