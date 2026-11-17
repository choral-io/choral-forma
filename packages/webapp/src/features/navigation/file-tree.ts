import type { DashboardDirectory, DashboardEntry } from "@/data/workspace-client";
import { isSystemRoutePath } from "@/lib/workspace-routes";

import { compareText } from "./directory-listing";
import { directoryOwners } from "./directory-owners";
import { describeDuplicateSiblings, type NavigationNode } from "./navigation-tree";

type FileTreeEntry = Pick<DashboardEntry, "path" | "routePath" | "title">;

/** The Files tree uses Core's directory and document routes. Each document appears once. */
export function buildFileTree(
    allEntries: readonly FileTreeEntry[],
    directories: readonly DashboardDirectory[],
): NavigationNode[] {
    const entries = allEntries.filter((entry) => !isSystemRoutePath(entry.routePath));
    const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));
    const directoriesByPath = new Map(directories.map((directory) => [directory.path, directory]));
    const owners = directoryOwners(entries, directories);

    function fileNode(entry: FileTreeEntry): NavigationNode {
        return {
            id: `entry:${entry.path}`,
            kind: "entry",
            label: entry.title,
            name: entry.path.split("/").at(-1) ?? entry.path,
            title: entry.path,
            to: entry.routePath,
            documentPath: entry.path,
        };
    }

    function childDirectories(directory: DashboardDirectory) {
        return directory.childDirectoryPaths.flatMap((path) => {
            const child = directoriesByPath.get(path);
            return child ? [child] : [];
        });
    }

    function directoryNode(directory: DashboardDirectory): NavigationNode {
        const segments = [];
        let current = directory;
        for (;;) {
            segments.push({
                path: current.path,
                label: current.path.split("/").at(-1) ?? current.path,
                to: current.routePath,
            });
            const [child, sibling] = childDirectories(current);
            if (
                owners.has(current.path) ||
                !child ||
                sibling ||
                owners.has(child.path) ||
                current.entryPaths.some((path) => entriesByPath.has(path))
            )
                break;
            current = child;
        }

        const relativePath = segments.map((segment) => segment.label).join("/");
        const childFiles = current.entryPaths.flatMap((path) => {
            const entry = entriesByPath.get(path);
            return entry ? [fileNode(entry)] : [];
        });
        const children = [
            ...childDirectories(current).map(directoryNode).sort(compareNodes),
            ...childFiles.sort(compareNodes),
        ];
        return {
            id: `directory:${current.path}`,
            kind: "directory",
            label: owners.get(current.path)?.title ?? relativePath,
            name: `${relativePath}/`,
            title: current.path,
            to: current.routePath,
            ...(segments.length > 1 ? { segments } : {}),
            ...(children.length > 0 ? { children } : {}),
        };
    }

    const home = entries.find((entry) => entry.routePath === "/");
    const homeNode: NavigationNode[] = home
        ? [{ id: "home", kind: "home", label: home.title, title: home.path, to: "/" }]
        : [];
    const rootDirectories = directories
        .filter((directory) => !directory.path.includes("/"))
        .map(directoryNode)
        .sort(compareNodes);
    const rootFiles = entries
        .filter((entry) => entry !== home && !entry.path.includes("/"))
        .map(fileNode)
        .sort(compareNodes);
    return describeDuplicateSiblings([...homeNode, ...rootDirectories, ...rootFiles]);
}

/** Siblings sort by displayed text; equal labels fall back to their names, so the order is stable. */
function compareNodes(left: NavigationNode, right: NavigationNode) {
    return compareText(left.label, right.label) || compareText(left.name ?? "", right.name ?? "");
}
