import type { DashboardEntry } from "@/data/workspace-client";

import { directoryOwners } from "./directory-owners";

export interface DirectoryListingFolder {
    /** Documents anywhere below this folder. */
    documentCount: number;
    name: string;
    path: string;
    /** Title of the document that stands for this folder, such as its `index` file. */
    title?: string;
}

export interface DirectoryListing<T> {
    directories: DirectoryListingFolder[];
    entries: T[];
    path: string;
}

/**
 * The folders and documents directly inside `path`, sorted as the Files tree sorts them.
 * The empty path is the workspace root. A path that holds no document is not a directory.
 * A document that stands for a folder titles that folder and is not listed on its own.
 */
export function directoryListing<T extends Pick<DashboardEntry, "path" | "routePath" | "title">>(
    entries: readonly T[],
    path: string,
): DirectoryListing<T> | undefined {
    const owners = directoryOwners(entries);
    const ownerPaths = new Set([...owners.values()].map((owner) => owner.path));
    const directory = path.split("/").filter((segment) => segment.length > 0);
    const folders = new Map<string, number>();
    const documents: T[] = [];
    let found = directory.length === 0;

    for (const entry of entries) {
        // The workspace entry document is the root's own page, Home, not one of the root's pages.
        if (entry.routePath === "/") continue;
        const segments = entry.path.split("/").filter((segment) => segment.length > 0);
        if (!directory.every((segment, index) => segments[index] === segment)) continue;
        const rest = segments.slice(directory.length);
        if (rest.length === 0) continue;
        found = true;
        if (rest.length === 1) {
            if (!ownerPaths.has(entry.path)) documents.push(entry);
        } else folders.set(rest[0] ?? "", (folders.get(rest[0] ?? "") ?? 0) + 1);
    }
    if (!found) return undefined;

    const prefix = directory.join("/");
    return {
        directories: [...folders]
            .map(([name, documentCount]): DirectoryListingFolder => {
                const folderPath = prefix ? `${prefix}/${name}` : name;
                const title = owners.get(folderPath)?.title;
                return { documentCount, name, path: folderPath, ...(title ? { title } : {}) };
            })
            .sort(
                (left, right) =>
                    compareText(left.title ?? left.name, right.title ?? right.name) ||
                    compareText(left.name, right.name),
            ),
        entries: documents.sort((left, right) => compareText(left.title, right.title)),
        path: prefix,
    };
}

export function compareText(left: string, right: string) {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

/** A listing's folder and page counts, such as "2 folders · 3 pages". */
export function listingCounts(listing: DirectoryListing<unknown>) {
    return [
        listing.directories.length > 0 ? pluralCount(listing.directories.length, "folder") : undefined,
        listing.entries.length > 0 ? pluralCount(listing.entries.length, "page") : undefined,
    ]
        .filter(Boolean)
        .join(" · ");
}

export function pluralCount(count: number, noun: string) {
    return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}
