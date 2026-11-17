import { canonicalRoutePath, resolveDashboardEntryTarget } from "./static-route-target";
import { logicalPathname } from "./static-runtime";
import type { DashboardEntry, DashboardViewRender, WorkspaceDashboard } from "./workspace-client";
import { createWorkspaceDashboardContext } from "./workspace-client";
import { staticWorkspaceClient } from "./workspace-client-source";

export interface PreparedStaticRoute {
    entry?: DashboardEntry;
    view?: DashboardViewRender;
}

let dashboard: WorkspaceDashboard | undefined;
const preparedRoutes = new Map<string, PreparedStaticRoute>();
const preparedRouteListeners = new Set<() => void>();

export async function prepareStaticEnhancement(pathname: string) {
    if (!staticWorkspaceClient) return undefined;
    const projection = await staticWorkspaceClient.getDashboard();
    const routePath = canonicalRoutePath(logicalPathname(pathname));
    await staticWorkspaceClient.verifyStaticBootstrap(routePath);
    dashboard = projection;
    return prepareStaticRoute(routePath);
}

export function readPreparedStaticEnhancement() {
    return dashboard ? { dashboard } : undefined;
}

export function hasStaticRoute(pathname: string) {
    return staticWorkspaceClient?.hasStaticRoute(pathname) ?? false;
}

export function readPreparedStaticRoute(pathname: string) {
    return preparedRoutes.get(pathname);
}

export function subscribePreparedStaticRoutes(listener: () => void) {
    preparedRouteListeners.add(listener);
    return () => {
        preparedRouteListeners.delete(listener);
    };
}

export async function prepareStaticRoute(pathname: string) {
    const cached = readPreparedStaticRoute(pathname);
    if (cached) return cached;
    if (!staticWorkspaceClient || !dashboard) throw new Error("Static artifact manifest has not been prepared.");

    await staticWorkspaceClient.prepareStaticRoute(pathname);
    const context = createWorkspaceDashboardContext(dashboard);
    const directory = dashboard.directories.find((candidate) => candidate.routePath === pathname);
    const entryPath = directory?.introEntryPath ?? resolveDashboardEntryTarget(dashboard, pathname)?.summary.path;
    const view = dashboard.views.find((candidate) => candidate.routePath === pathname);
    // These reads consume the validated cache from prepareStaticRoute before the Router commits.
    const route: PreparedStaticRoute = {};
    if (entryPath && pathname !== "/") {
        route.entry = await staticWorkspaceClient.getEntry(entryPath, context, { directoryPath: directory?.path });
    }
    if (view) route.view = await staticWorkspaceClient.getViewRender(view.configId, context);
    preparedRoutes.set(pathname, route);
    for (const listener of preparedRouteListeners) listener();
    return route;
}
