import type { DashboardEntry, WorkspaceDashboard } from "./workspace-client";

export interface DashboardEntryTarget {
    entryId: string;
    summary: DashboardEntry;
}

export function resolveDashboardEntryTarget(
    dashboard: WorkspaceDashboard,
    routePath: string,
): DashboardEntryTarget | undefined {
    const canonical = dashboard.entries.find((entry) => entry.routePath === routePath);
    if (canonical) return { entryId: canonical.id, summary: canonical };

    for (const entry of dashboard.entries) {
        const variant = entry.variants.find((candidate) => candidate.routePath === routePath);
        if (!variant?.id) continue;
        const title = variant.title?.trim();
        return {
            entryId: variant.id,
            summary: {
                ...entry,
                id: variant.id,
                kind: variant.kind,
                path: variant.path,
                routePath: variant.routePath,
                rawPath: variant.rawPath,
                title: title === undefined || title === "" ? variant.path : title,
                omitLeadingTitle: variant.omitLeadingTitle ?? false,
                summary: variant.summary ?? entry.summary,
            },
        };
    }
    return undefined;
}
