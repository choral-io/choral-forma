import type { DashboardDirectory } from "@/data/workspace-client";

export function directoryOwners(projection: readonly DashboardDirectory[]) {
    return new Map(
        projection.flatMap(({ path, introduction }) => (introduction ? [[path, introduction] as const] : [])),
    );
}

export function directoryLabel(owners: ReadonlyMap<string, { title?: string | null }>, path: string) {
    return owners.get(path)?.title ?? path.split("/").at(-1) ?? path;
}
