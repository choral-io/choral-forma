import { lazy, Suspense } from "react";
import { useLocation } from "react-router";

import { canonicalRoutePath } from "@/data/static-route-target";
import type { DashboardViewProjection, DashboardViewRender, WorkspaceDashboard } from "@/data/workspace-client";
import { EmptyPage } from "@/features/workspace/RouteContent";
import { SourcePath } from "@/features/workspace/SourcePath";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { useWorkspacePage } from "@/features/workspace/use-workspace-page";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { viewsRoutePath } from "@/lib/workspace-routes";

import { ProjectionLoadingState, ViewProjectionRenderer } from "./ViewProjectionRenderer";

const ViewDocumentMarkdown = lazy(async () => {
    const module = await import("./ViewDocumentMarkdown");
    return { default: module.ViewDocumentMarkdown };
});

const viewsBreadcrumb = [{ label: "Views", to: viewsRoutePath }];

export function ViewRoute() {
    const dashboard = useWorkspaceDashboard();
    const { pathname } = useLocation();
    const routePath = canonicalRoutePath(pathname);
    const view = dashboard.views.find((item) => item.routePath === routePath);
    const { view: render } = useWorkspacePage();

    if (!view) {
        return (
            <WorkspaceRouteFrame breadcrumb={viewsBreadcrumb} title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    return (
        <WorkspaceRouteFrame
            contentWidth={view.kind === "list" ? "readable" : "fluid"}
            description={view.description}
            breadcrumb={viewsBreadcrumb}
            title={view.title}
        >
            <ViewPage dashboard={dashboard} key={view.configId} render={render} view={view} />
        </WorkspaceRouteFrame>
    );
}

function ViewPage({
    dashboard,
    render,
    view,
}: {
    dashboard: WorkspaceDashboard;
    render?: DashboardViewRender;
    view: WorkspaceDashboard["views"][number];
}) {
    const projection = render?.projection;
    const entries = entriesForView(dashboard, view);
    const itemCount = projection ? projectionItemCount(projection) : entries.length;
    const hasDocumentMarkdown = Boolean(
        render && (render.document.beforeProjection.trim() || render.document.afterProjection.trim()),
    );
    const projectionElement = <ViewProjectionRenderer projection={projection} />;

    return (
        <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                <span className="badge badge-outline badge-sm">{view.kind}</span>
                <span>{view.space ?? "workspace"}</span>
                <span>{itemCount} items</span>
                <SourcePath path={view.sourcePath} />
            </div>
            {hasDocumentMarkdown && render ? (
                <Suspense fallback={<ProjectionLoadingState />}>
                    <ViewDocumentMarkdown document={render.document} entries={dashboard.entries}>
                        {projectionElement}
                    </ViewDocumentMarkdown>
                </Suspense>
            ) : (
                projectionElement
            )}
        </div>
    );
}

function entriesForView(dashboard: WorkspaceDashboard, view: WorkspaceDashboard["views"][number]) {
    return view.space ? dashboard.entries.filter((entry) => entry.space === view.space) : dashboard.entries;
}

function projectionItemCount(projection: DashboardViewProjection) {
    if (projection.kind === "calendar" || projection.kind === "gantt") return projection.counts.candidates;
    if (projection.kind === "kanban") {
        return projection.columns.reduce((total, column) => total + column.items.length, 0);
    }

    if (projection.kind === "graph") {
        return projection.nodes.length;
    }

    return projection.items.length;
}
