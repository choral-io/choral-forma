import { dashboardEntryByPath } from "@/data/static-route-target";
import type { DashboardDirectory, DashboardEntry, WorkspaceDashboard } from "@/data/workspace-client";

export interface DirectoryListingFolder {
    /** Documents anywhere below this folder. */
    documentCount: number;
    name: string;
    path: string;
    routePath: string;
    /** Title of the document that stands for this folder, such as its `index` file. */
    title?: string;
}

export interface DirectoryListing<T> {
    directories: DirectoryListingFolder[];
    entries: T[];
    path: string;
}

/** Use the public directory projection for navigation and include directly indexed variants. */
export function projectedDirectoryListing(
    dashboard: WorkspaceDashboard,
    directory: DashboardDirectory,
): DirectoryListing<DashboardEntry> {
    const directoriesByPath = new Map(dashboard.directories.map((child) => [child.path, child]));
    const directories = directory.childDirectoryPaths.flatMap((path): DirectoryListingFolder[] => {
        const child = directoriesByPath.get(path);
        if (!child) return [];
        const title = child.introEntryPath ? dashboardEntryByPath(dashboard, child.introEntryPath)?.title : undefined;
        const documentCount = dashboard.directories
            .filter((candidate) => candidate.path === path || candidate.path.startsWith(`${path}/`))
            .reduce((total, candidate) => total + candidate.entryPaths.length, 0);
        return [{ path, routePath: child.routePath, name: path.split("/").at(-1) ?? path, title, documentCount }];
    });
    const entries = directory.entryPaths.flatMap((path) => {
        const entry = dashboardEntryByPath(dashboard, path);
        return entry ? [entry] : [];
    });
    return {
        path: directory.path,
        directories: directories.sort(
            (left, right) =>
                compareText(left.title ?? left.name, right.title ?? right.name) || compareText(left.name, right.name),
        ),
        entries: entries.sort((left, right) => compareText(left.title, right.title)),
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
