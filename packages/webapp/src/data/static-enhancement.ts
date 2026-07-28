import { viewRoutePath } from "@/lib/workspace-routes";

import { resolveDashboardEntryTarget } from "./static-route-target";
import { logicalPathname } from "./static-runtime";
import type { DashboardEntry, DashboardViewRender, WorkspaceDashboard } from "./workspace-client";
import { isStaticWorkspaceClient, workspaceClient } from "./workspace-client-source";

export interface PreparedStaticEnhancement {
    dashboard: WorkspaceDashboard;
    entry?: { detail: DashboardEntry; routePath: string };
    view?: { render: DashboardViewRender; viewId: string };
}

let prepared: PreparedStaticEnhancement | undefined;

export async function prepareStaticEnhancement(pathname: string) {
    if (!isStaticWorkspaceClient) return undefined;

    const dashboard = await workspaceClient.getDashboard();
    const routePath = logicalPathname(pathname);
    const seed: PreparedStaticEnhancement = { dashboard };

    if (routePath.startsWith("/pages/")) {
        const target = resolveDashboardEntryTarget(dashboard, routePath);
        if (!target) throw new Error(`Static artifact route was not listed: ${routePath}`);
        seed.entry = {
            detail: await workspaceClient.getEntry(target.entryId),
            routePath,
        };
    } else if (routePath.startsWith("/views/")) {
        const view = dashboard.views.find((candidate) => viewRoutePath(candidate.id) === routePath);
        if (!view) throw new Error(`Static artifact View route was not listed: ${routePath}`);
        seed.view = {
            render: await workspaceClient.getViewRender(view.id),
            viewId: view.id,
        };
    } else if (!isDashboardOnlyRoute(dashboard, routePath)) {
        throw new Error(`Static artifact route cannot be enhanced: ${routePath}`);
    }

    prepared = seed;
    return seed;
}

export function readPreparedStaticEnhancement() {
    return prepared;
}

function isDashboardOnlyRoute(dashboard: WorkspaceDashboard, routePath: string) {
    if (["/", "/pages", "/views", "/browse", "/health"].includes(routePath)) return true;
    return dashboard.taxonomies.some(
        (taxonomy) =>
            routePath === `/${encodeURIComponent(taxonomy.id)}` ||
            taxonomy.terms.some(
                (term) => routePath === `/${encodeURIComponent(taxonomy.id)}/${encodeURIComponent(term.id)}`,
            ),
    );
}
