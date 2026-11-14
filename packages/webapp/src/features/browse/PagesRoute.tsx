import { FileText } from "lucide-react";
import { useId, type ReactNode } from "react";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { RouteBodySection } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceDefaultContextPanel, WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { cn } from "@/lib/utils";

import { PagesList } from "./PagesList";

export function PagesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspaceRouteFrame contextPanel={<PagesContextPanel dashboard={dashboard} />} title="Pages">
            <PagesPage dashboard={dashboard} />
        </WorkspaceRouteFrame>
    );
}

function PagesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <PagesOverview dashboard={dashboard} />
            <RouteBodySection
                description="Global page index from the workspace read model."
                meta={`${String(dashboard.entries.length)} indexed`}
                title="All pages"
            >
                <PagesList entries={dashboard.entries} />
            </RouteBodySection>
        </div>
    );
}

function PagesContextPanel({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.entries.filter((entry) => entry.status !== "healthy").length;
    const coveredTaxonomyCount = dashboard.taxonomies.filter((taxonomy) =>
        taxonomy.terms.some((term) => term.entryCount > 0),
    ).length;

    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">Page Index</h2>
                            <p className="mt-1 text-sm/6 text-base-content/60">
                                Route-level read model for the global page list.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Indexed" value={dashboard.entries.length} />
                            <ContextStat label="Taxonomies" value={coveredTaxonomyCount} />
                            <ContextStat label="Warnings" value={warningCount} />
                        </div>
                    </section>
                    <hr className="border-base-300" />
                    <WorkspaceDefaultContextPanel dashboard={dashboard} />
                </>
            }
        />
    );
}

function ContextPanelTabs({
    context,
    outline,
    outlineDesktopOnly = false,
}: {
    context: ReactNode;
    outline?: ReactNode;
    outlineDesktopOnly?: boolean;
}) {
    const hasOutline = outline !== undefined && outline !== null;
    const tabId = useId();

    if (!hasOutline) {
        return <div className="flex flex-col gap-4 p-4 md:p-6 xl:min-h-0 xl:overflow-auto">{context}</div>;
    }

    return (
        <div className="tabs-border tabs grid grid-cols-2 xl:h-full xl:min-h-0" role="tablist">
            <input aria-label="Context" className="tab" defaultChecked name={tabId} role="tab" type="radio" />
            <div className="tab-content col-span-2 p-4 md:p-6 xl:min-h-0 xl:overflow-auto" role="tabpanel">
                <div className="flex flex-col gap-4">{context}</div>
            </div>
            <input
                aria-label="Outline"
                className={cn("tab", outlineDesktopOnly && "hidden xl:inline-grid")}
                name={tabId}
                role="tab"
                type="radio"
            />
            <div
                className={cn(
                    "tab-content col-span-2 p-4 md:p-6 xl:min-h-0 xl:overflow-auto",
                    outlineDesktopOnly && "hidden xl:block",
                )}
                role="tabpanel"
            >
                <div className="flex flex-col gap-3">{outline}</div>
            </div>
        </div>
    );
}

function PagesOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.entries.filter((entry) => entry.status !== "healthy").length;
    const coveredTaxonomyCount = dashboard.taxonomies.filter((taxonomy) =>
        taxonomy.terms.some((term) => term.entryCount > 0),
    ).length;

    return (
        <section className="card border border-base-300 bg-base-100">
            <div className="card-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className={warningCount > 0 ? "badge badge-warning" : "badge"}>{dashboard.status}</span>
                        <h2 className="mt-4 card-title">Pages overview</h2>
                        <p className="mt-2 text-sm text-base-content/60">
                            Global read-only index for Markdown pages in the workspace.
                        </p>
                    </div>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-base-200 text-base-content/60">
                        <FileText data-icon="inline-start" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:gap-3 sm:px-6 sm:pb-6">
                <StatCell label="Indexed" value={dashboard.entries.length} />
                <StatCell label="Taxonomies" value={coveredTaxonomyCount} />
                <StatCell label="Warnings" value={warningCount} />
            </div>
        </section>
    );
}

function ContextStat({ label, title, value }: { label: string; title?: string; value: number | string }) {
    return (
        <div className="rounded-lg border border-base-300/80 bg-base-100/60 p-3">
            <span className="text-xs text-base-content/60">{label}</span>
            <strong className="mt-1 block truncate text-sm" title={title}>
                {value}
            </strong>
        </div>
    );
}

function StatCell({ label, title, value }: { label: string; title?: string; value: number | string }) {
    return (
        <div className="rounded-md border border-base-300 bg-base-100 p-2 sm:p-3">
            <span className="text-xs text-base-content/60">{label}</span>
            <strong className="mt-1 block truncate text-sm sm:text-base" title={title ?? String(value)}>
                {value}
            </strong>
        </div>
    );
}
