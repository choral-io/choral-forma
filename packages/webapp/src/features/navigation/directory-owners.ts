import type { DashboardDirectory, DashboardEntry } from "@/data/workspace-client";

type OwnerCandidate = Pick<DashboardEntry, "path" | "routePath" | "title">;

/** The indexed introduction Core selected for each directory. */
export function directoryOwners<T extends OwnerCandidate>(
    entries: readonly T[],
    projection: readonly DashboardDirectory[],
): Map<string, T> {
    const byPath = new Map(entries.map((entry) => [entry.path, entry]));
    return new Map(
        projection.flatMap((directory) => {
            const entry = directory.introEntryPath ? byPath.get(directory.introEntryPath) : undefined;
            return entry ? [[directory.path, entry] as const] : [];
        }),
    );
}

/** The label for a directory: its owning document's title, otherwise its own name. */
export function directoryLabel(owners: ReadonlyMap<string, Pick<DashboardEntry, "title">>, path: string) {
    return owners.get(path)?.title ?? path.split("/").at(-1) ?? path;
}
