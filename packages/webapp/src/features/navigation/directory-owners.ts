import type { DashboardEntry } from "@/data/workspace-client";
import { directoryPathFromRoutePath } from "@/lib/workspace-routes";

type OwnerCandidate = Pick<DashboardEntry, "path" | "routePath" | "title">;

/**
 * The documents served at a directory's route, keyed by directory path. Core serves
 * `x/index.md` at `/x`, and a `x.md` beside `x/` has that route too; such a document
 * stands for the directory wherever the directory is shown.
 */
export function directoryOwners<T extends OwnerCandidate>(entries: readonly T[]): Map<string, T> {
    const directories = new Set<string>();
    for (const entry of entries) {
        const segments = entry.path.split("/").filter((segment) => segment.length > 0);
        for (let length = 1; length < segments.length; length += 1) {
            directories.add(segments.slice(0, length).join("/"));
        }
    }

    const owners = new Map<string, T>();
    for (const entry of entries) {
        const directory = directoryPathFromRoutePath(entry.routePath);
        if (directory && directories.has(directory) && !owners.has(directory)) owners.set(directory, entry);
    }
    return owners;
}

/** The label for a directory: its owning document's title, otherwise its own name. */
export function directoryLabel(owners: ReadonlyMap<string, Pick<DashboardEntry, "title">>, path: string) {
    return owners.get(path)?.title ?? path.split("/").at(-1) ?? path;
}
