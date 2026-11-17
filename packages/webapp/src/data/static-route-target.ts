import { encodeRouteSegment } from "@/lib/workspace-routes";

import { trimRoutePathname } from "./static-runtime";
import type { DashboardEntry, WorkspaceDashboard } from "./workspace-client";

export interface DashboardEntryTarget {
    summary: DashboardEntry;
}

/** Canonicalize an app-relative pathname, such as the pathname from React Router. */
export function canonicalRoutePath(pathname: string) {
    return trimRoutePathname(pathname)
        .split("/")
        .map((segment) => canonicalRouteSegment(segment))
        .join("/");
}

function canonicalRouteSegment(segment: string) {
    let decoded = segment;
    try {
        decoded = decodeURIComponent(segment);
    } catch {
        // A raw literal percent is valid in a workspace filename and is encoded below.
    }
    return encodeRouteSegment(decoded);
}

export function resolveDashboardEntryTarget(
    dashboard: WorkspaceDashboard,
    routePath: string,
): DashboardEntryTarget | undefined {
    const canonical = dashboard.entries.find((entry) => entry.routePath === routePath);
    if (canonical) return { summary: canonical };

    for (const entry of dashboard.entries) {
        const variant = entry.variants.find((candidate) => candidate.routePath === routePath);
        if (variant) return { summary: variantSummary(entry, variant) };
    }
    return undefined;
}

export function dashboardEntryByPath(dashboard: WorkspaceDashboard, path: string): DashboardEntry | undefined {
    for (const entry of dashboard.entries) {
        if (entry.path === path) return entry;
        const variant = entry.variants.find((candidate) => candidate.path === path);
        if (variant) return variantSummary(entry, variant);
    }
    return undefined;
}

function variantSummary(entry: DashboardEntry, variant: DashboardEntry["variants"][number]): DashboardEntry {
    const title = variant.title?.trim();
    return {
        ...entry,
        id: variant.id ?? entry.id,
        kind: variant.kind,
        path: variant.path,
        routePath: variant.routePath,
        rawPath: variant.rawPath,
        title: title === undefined || title.length === 0 ? variant.path : title,
        omitLeadingTitle: variant.omitLeadingTitle ?? false,
        summary: variant.summary ?? entry.summary,
    };
}
