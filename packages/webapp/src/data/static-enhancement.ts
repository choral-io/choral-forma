import {
    browseRoutePath,
    directoryForRoutePath,
    healthRoutePath,
    isSystemRoutePath,
    taxonomyRoutePath,
    taxonomyTermRoutePath,
    viewRoutePath,
    viewsRoutePath,
} from "@/lib/workspace-routes";

import { resolveDashboardEntryTarget } from "./static-route-target";
import { logicalPathname } from "./static-runtime";
import type { DashboardEntry, DashboardViewRender, WorkspaceDashboard } from "./workspace-client";
import { createWorkspaceDashboardContext } from "./workspace-client";
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
    const dashboardContext = createWorkspaceDashboardContext(dashboard);
    const routePath = logicalPathname(pathname);
    const seed: PreparedStaticEnhancement = { dashboard };

    // Home and the system pages render from the dashboard alone; any other route is content.
    const isContentRoute = routePath !== "/" && !isSystemRoutePath(routePath);
    const pageTarget = isContentRoute ? resolveDashboardEntryTarget(dashboard, routePath) : undefined;
    const directory = directoryForRoutePath(dashboard.entries, routePath);
    // A document served at a route wins; a directory page lists the dashboard's own entries.
    if (pageTarget) {
        seed.entry = {
            detail: await workspaceClient.getEntry(pageTarget.entryId, dashboardContext),
            routePath,
        };
    } else if (isContentRoute && !directory) {
        throw new Error(`Static artifact route was not listed: ${routePath}`);
    } else if (routePath.startsWith(`${viewsRoutePath}/`)) {
        const view = dashboard.views.find((candidate) => viewRoutePath(candidate.id) === routePath);
        if (!view) throw new Error(`Static artifact View route was not listed: ${routePath}`);
        seed.view = {
            render: await workspaceClient.getViewRender(view.id, dashboardContext),
            viewId: view.id,
        };
    } else if (!isDashboardOnlyRoute(dashboard, routePath) && !directory) {
        throw new Error(`Static artifact route cannot be enhanced: ${routePath}`);
    }

    prepared = seed;
    return seed;
}

export function readPreparedStaticEnhancement() {
    return prepared;
}

function isDashboardOnlyRoute(dashboard: WorkspaceDashboard, routePath: string) {
    if (["/", viewsRoutePath, browseRoutePath, healthRoutePath].includes(routePath)) return true;
    return dashboard.taxonomies.some(
        (taxonomy) =>
            routePath === taxonomyRoutePath(taxonomy.id) ||
            taxonomy.terms.some((term) => routePath === taxonomyTermRoutePath(taxonomy.id, term.id)),
    );
}
