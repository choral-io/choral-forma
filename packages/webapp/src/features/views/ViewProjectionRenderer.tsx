import { AlertTriangle, RefreshCw } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link } from "react-router";

import type { DashboardViewProjection, DashboardViewProjectionItem } from "@/data/workspace-client";

const ViewGraphProjection = lazy(async () => {
    const module = await import("./ViewGraphProjection");
    return { default: module.ViewGraphProjection };
});

const ViewKanbanProjection = lazy(async () => {
    const module = await import("./ViewKanbanProjection");
    return { default: module.ViewKanbanProjection };
});

const ViewTableProjection = lazy(async () => {
    const module = await import("./ViewTableProjection");
    return { default: module.ViewTableProjection };
});

const ViewCalendarProjection = lazy(async () => {
    const module = await import("./ViewCalendarProjection");
    return { default: module.ViewCalendarProjection };
});
const ViewGanttProjection = lazy(async () => {
    const module = await import("./ViewGanttProjection");
    return { default: module.ViewGanttProjection };
});

export function ViewProjectionRenderer({
    error,
    onRetry,
    projection,
}: {
    error?: string;
    onRetry: () => void;
    projection?: DashboardViewProjection;
}) {
    if (error) {
        return <ProjectionErrorState message={error} onRetry={onRetry} />;
    }

    if (!projection) {
        return <ProjectionLoadingState />;
    }

    if (projection.kind === "list") {
        return <ViewListProjection projection={projection} />;
    }

    return (
        <Suspense fallback={<ProjectionLoadingState />}>
            {projection.kind === "gantt" ? (
                <ViewGanttProjection
                    key={JSON.stringify([projection.timeZone, projection.rows])}
                    projection={projection}
                />
            ) : projection.kind === "calendar" ? (
                <ViewCalendarProjection key={projection.timeZone} projection={projection} />
            ) : projection.kind === "graph" ? (
                <ViewGraphProjection projection={projection} />
            ) : projection.kind === "kanban" ? (
                <ViewKanbanProjection projection={projection} />
            ) : (
                <ViewTableProjection projection={projection} />
            )}
        </Suspense>
    );
}

export function ProjectionLoadingState() {
    return (
        <div className="rounded-lg border border-dashed border-base-300 p-6 text-sm text-base-content/60">
            Loading view projection...
        </div>
    );
}

function ProjectionErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="alert alert-vertical alert-soft alert-error sm:alert-horizontal" role="alert">
            <AlertTriangle aria-hidden="true" className="size-5" />
            <div>
                <h2 className="font-semibold">View projection failed to load</h2>
                <p className="text-sm">{message}</p>
            </div>
            <button className="btn btn-sm" onClick={onRetry} type="button">
                <RefreshCw aria-hidden="true" className="size-4" />
                Retry
            </button>
        </div>
    );
}

function ViewListProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "list" }> }) {
    return (
        <div className="overflow-hidden border-y border-base-300">
            <div className="divide-y divide-base-300">
                {projection.items.map((item) => (
                    <ViewListProjectionRow item={item} key={item.path} />
                ))}
                {projection.items.length === 0 ? (
                    <p className="p-4 text-sm text-base-content/60">No items match this view.</p>
                ) : null}
            </div>
        </div>
    );
}

function ViewListProjectionRow({ item }: { item: DashboardViewProjectionItem }) {
    const summary = item.fields.summary;
    const content = (
        <>
            <span className="block truncate font-medium" title={item.title}>
                {item.title}
            </span>
            {summary ? (
                <span className="mt-1 line-clamp-2 block text-sm text-base-content/60" title={summary}>
                    {summary}
                </span>
            ) : null}
            <code className="mt-2 block truncate text-xs text-base-content/60" title={item.path}>
                {item.path}
            </code>
        </>
    );

    if (!item.routePath) {
        return <div className="p-4">{content}</div>;
    }

    return (
        <Link
            className="block p-4 transition-colors outline-none hover:bg-base-200/50 focus-visible:ring-3 focus-visible:ring-primary/50"
            to={item.routePath}
        >
            {content}
        </Link>
    );
}
