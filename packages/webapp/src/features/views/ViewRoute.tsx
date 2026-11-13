import { Copy } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { readPreparedStaticEnhancement } from "@/data/static-enhancement";
import type { DashboardViewProjection, DashboardViewRender, WorkspaceDashboard } from "@/data/workspace-client";
import { createWorkspaceDashboardContext } from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { EmptyPage } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { copySourcePath } from "@/lib/copy-source-path";

import { ProjectionLoadingState, ViewProjectionRenderer } from "./ViewProjectionRenderer";

const ViewDocumentMarkdown = lazy(async () => {
    const module = await import("./ViewDocumentMarkdown");
    return { default: module.ViewDocumentMarkdown };
});

export function ViewRoute() {
    const dashboard = useWorkspaceDashboard();
    const dashboardContext = useMemo(() => createWorkspaceDashboardContext(dashboard), [dashboard]);
    const params = useParams();
    const viewId = params["*"]?.replace(/\/+$/u, "");
    const view = dashboard.views.find((item) => item.id === viewId);
    const [renderRequestVersion, setRenderRequestVersion] = useState(0);
    const preparedView = readPreparedStaticEnhancement()?.view;
    const [renderState, setRenderState] = useState<
        | {
              render: DashboardViewRender;
              status: "ready";
              viewId: string;
          }
        | {
              message: string;
              status: "error";
              viewId: string;
          }
        | undefined
    >(() =>
        preparedView && preparedView.viewId === viewId
            ? { render: preparedView.render, status: "ready", viewId: preparedView.viewId }
            : undefined,
    );
    const hasPreparedRender = renderState?.status === "ready" && renderState.viewId === viewId;

    useEffect(() => {
        if (!viewId || hasPreparedRender) {
            return;
        }

        let cancelled = false;
        workspaceClient
            .getViewRender(viewId, dashboardContext)
            .then((render) => {
                if (!cancelled) {
                    setRenderState({ render, status: "ready", viewId });
                }
            })
            .catch((error: unknown) => {
                console.warn("View projection failed to load.", error);
                if (!cancelled) {
                    setRenderState({
                        message: error instanceof Error ? error.message : "The workspace backend returned an error.",
                        status: "error",
                        viewId,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [dashboardContext, hasPreparedRender, renderRequestVersion, viewId]);

    if (!view) {
        return (
            <WorkspaceRouteFrame eyebrow="Views" title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    const currentRenderState = renderState?.viewId === viewId ? renderState : undefined;
    const render = currentRenderState?.status === "ready" ? currentRenderState.render : undefined;
    const renderError = currentRenderState?.status === "error" ? currentRenderState.message : undefined;

    return (
        <WorkspaceRouteFrame
            contentWidth={view.kind === "list" ? "readable" : "fluid"}
            description={view.description}
            eyebrow="Views"
            title={view.title}
        >
            <ViewPage
                dashboard={dashboard}
                key={viewId}
                onRetry={() => {
                    setRenderState(undefined);
                    setRenderRequestVersion((version) => version + 1);
                }}
                render={render}
                renderError={renderError}
                view={view}
            />
        </WorkspaceRouteFrame>
    );
}

function ViewPage({
    dashboard,
    onRetry,
    render,
    renderError,
    view,
}: {
    dashboard: WorkspaceDashboard;
    onRetry: () => void;
    render?: DashboardViewRender;
    renderError?: string;
    view: WorkspaceDashboard["views"][number];
}) {
    const projection = render?.projection;
    const entries = entriesForView(dashboard, view);
    const itemCount = projection ? projectionItemCount(projection) : entries.length;
    const hasDocumentMarkdown = Boolean(
        render && (render.document.beforeProjection.trim() || render.document.afterProjection.trim()),
    );
    const projectionElement = <ViewProjectionRenderer error={renderError} onRetry={onRetry} projection={projection} />;

    return (
        <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                <span className="badge badge-outline badge-sm">{view.kind}</span>
                <span>{view.space ?? "workspace"}</span>
                <span>{itemCount} items</span>
                <span className="flex min-w-0 basis-full items-center gap-1">
                    <code className="min-w-0 break-all">{view.path}</code>
                    <button
                        aria-label={`Copy source path ${view.path}`}
                        className="btn shrink-0 btn-ghost btn-xs"
                        onClick={(event) => {
                            void copySourcePath(event.currentTarget, view.path);
                        }}
                        type="button"
                    >
                        <Copy aria-hidden="true" className="size-3.5" />
                        <span data-source-action-label>Copy path</span>
                    </button>
                </span>
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
