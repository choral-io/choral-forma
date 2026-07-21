const GRAPH_OWNED_MUTATION_SELECTOR = "[data-forma-graph-summary], [data-forma-graph-expand]";

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
