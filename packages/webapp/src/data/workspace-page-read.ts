import { resolveDashboardEntryTarget } from "./static-route-target";
import type { DashboardEntry, DashboardViewRender, WorkspaceClient, WorkspaceDashboard } from "./workspace-client";
import { createWorkspaceDashboardContext } from "./workspace-client";

export interface WorkspacePageRead {
    entry?: DashboardEntry;
    view?: DashboardViewRender;
}

export async function readWorkspacePage(
    client: WorkspaceClient,
    dashboard: WorkspaceDashboard,
    pathname: string,
): Promise<WorkspacePageRead> {
    const context = createWorkspaceDashboardContext(dashboard);
    if (dashboard.directories.some((directory) => directory.routePath === pathname)) return {};
    const summary = resolveDashboardEntryTarget(dashboard, pathname)?.summary;
    if (summary) return { entry: await client.getEntry(summary.path, context) };
    const view = dashboard.views.find((candidate) => candidate.routePath === pathname);
    if (view) return { view: await client.getViewRender(view.configId, context) };
    return {};
}

export function isGenerationMismatch(error: unknown) {
    return error instanceof Error && "code" in error && error.code === "route.generationMismatch";
}

export function isSupersededRouteRead(error: unknown) {
    return error instanceof Error && "code" in error && error.code === "route.superseded";
}

export async function readWorkspacePageGroup(client: WorkspaceClient, pathname: string, isCurrent: () => boolean) {
    for (let attempt = 0; ; attempt++) {
        try {
            const dashboard = await client.getDashboard();
            if (!isCurrent()) return undefined;
            const detail = await readWorkspacePage(client, dashboard, pathname);
            return isCurrent() ? { dashboard, detail } : undefined;
        } catch (error) {
            if (!isCurrent()) return undefined;
            if (attempt > 0 || !isGenerationMismatch(error)) throw error;
        }
    }
}
