import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { RouteBodySection } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { viewRoutePath } from "@/lib/workspace-routes";

export function ViewsRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspaceRouteFrame description="Read-only projections declared by workspace configuration." title="Views">
            <ViewsPage dashboard={dashboard} />
        </WorkspaceRouteFrame>
    );
}

function ViewsPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <RouteBodySection
            description="Choose a configured projection over the indexed workspace content."
            meta={`${String(dashboard.views.length)} views`}
            title="Configured views"
        >
            {dashboard.views.length > 0 ? (
                <ViewsGrid views={dashboard.views} />
            ) : (
                <p className="py-8 text-sm text-base-content/60">No views are configured.</p>
            )}
        </RouteBodySection>
    );
}

function ViewsGrid({ views }: { views: WorkspaceDashboard["views"] }) {
    return (
        <nav aria-label="Configured views" className="divide-y divide-base-300 border-y border-base-300">
            {views.map((view) => (
                <Link
                    className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                    key={view.id}
                    to={viewRoutePath(view.id)}
                >
                    <div className="min-w-0">
                        <div className="truncate font-medium" title={view.title}>
                            {view.title}
                        </div>
                        <div className="mt-1 line-clamp-1 text-sm text-base-content/60" title={view.description}>
                            {view.description}
                        </div>
                    </div>
                    <span className="badge hidden justify-self-start badge-outline badge-sm sm:inline-flex">
                        {view.kind}
                    </span>
                    <span className="hidden truncate text-sm text-base-content/60 sm:block">
                        {view.space ?? "workspace"}
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 justify-self-end text-base-content/50" />
                </Link>
            ))}
        </nav>
    );
}
