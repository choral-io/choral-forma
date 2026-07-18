const GRAPH_OWNED_MUTATION_SELECTOR = "[data-forma-graph-summary], [data-forma-graph-node-list]";

type MutationRecordLike = { target: unknown };
type ClosestTarget = { closest(selector: string): unknown };

export function shouldScheduleGraphReconcile(records: readonly MutationRecordLike[]): boolean {
    return records.some((record) => !isGraphOwnedMutationTarget(record.target));
}

function isGraphOwnedMutationTarget(target: unknown): boolean {
    if (!hasClosest(target)) return false;
    return Boolean(target.closest(GRAPH_OWNED_MUTATION_SELECTOR));
}

function hasClosest(target: unknown): target is ClosestTarget {
    return typeof target === "object" && target !== null && "closest" in target && typeof target.closest === "function";
}

export type GraphSummaryPresentation = {
    fingerprint: string;
    title: string;
    path: string;
    links: string;
};

export function graphSummaryPresentation(
    selected: { title?: string; path: string } | undefined,
    adjacentCount: number,
): GraphSummaryPresentation | undefined {
    if (!selected) return undefined;
    const title = selected.title ?? selected.path;
    const links = `${String(adjacentCount)} linked`;
    return {
        fingerprint: JSON.stringify([selected.path, title, links]),
        title,
        path: selected.path,
        links,
    };
}
