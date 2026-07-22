import { Menu, PanelRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { workspaceDrawerId } from "@/app/App";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { WorkspaceHealthPanel } from "@/features/diagnostics/DiagnosticsPanel";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";
import { cn } from "@/lib/utils";

interface WorkspaceRouteFrameProps {
    actions?: ReactNode;
    children: ReactNode;
    contextPanel?: ReactNode;
    dashboard: WorkspaceDashboard;
    mobileContextPanel?: ReactNode;
    contentWidth?: "default" | "fluid" | "readable";
    description?: string;
    eyebrow: string;
    title: string;
}

export function WorkspaceRouteFrame({
    actions,
    children,
    contextPanel,
    dashboard,
    mobileContextPanel,
    contentWidth = "default",
    description,
    eyebrow,
    title,
}: WorkspaceRouteFrameProps) {
    const hasContextPanel = Boolean(contextPanel);
    const inlineContextPanel = mobileContextPanel ?? contextPanel;
    const contentWidthClass = {
        default: "max-w-6xl",
        fluid: "max-w-none",
        readable: "max-w-4xl",
    }[contentWidth];

    return (
        <div
            className={cn(
                "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-auto xl:grid xl:grid-cols-1 xl:overflow-hidden",
                hasContextPanel && "xl:grid-cols-[minmax(0,1fr)_22rem]",
            )}
        >
            <div className="flex min-w-0 flex-col xl:min-h-0">
                <header className="border-base-300 bg-base-100/90 flex shrink-0 flex-col gap-4 border-b p-4 backdrop-blur-sm md:px-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <button
                            aria-controls={workspaceDrawerId}
                            aria-label="Open workspace navigation"
                            className="btn btn-square btn-ghost lg:hidden"
                            type="button"
                            onClick={() => {
                                const dialog = document.getElementById(workspaceDrawerId);
                                if (dialog instanceof HTMLDialogElement) {
                                    dialog.returnValue = "";
                                    dialog.showModal();
                                }
                            }}
                        >
                            <Menu aria-hidden="true" />
                        </button>
                        <div className="min-w-0">
                            <p className="text-base-content/60 text-sm">{eyebrow}</p>
                            <h1 className="truncate text-2xl font-semibold tracking-normal" tabIndex={-1} title={title}>
                                {title}
                            </h1>
                            {description && (
                                <p className="text-base-content/60 mt-1 max-w-3xl text-sm/6">{description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <QuickOpenDialog dashboard={dashboard} trigger="header" triggerClassName="lg:hidden" />
                        {actions}
                    </div>
                </header>

                {hasContextPanel && inlineContextPanel ? (
                    <details className="collapse-arrow border-base-300 bg-base-200/40 collapse rounded-none border-b xl:hidden">
                        <summary className="collapse-title flex items-center gap-2 text-sm font-medium">
                            <PanelRightIcon aria-hidden="true" className="size-4" />
                            Context and outline
                        </summary>
                        <div className="collapse-content">{inlineContextPanel}</div>
                    </details>
                ) : null}

                <main className="min-w-0 xl:min-h-0 xl:flex-1 xl:overflow-auto">
                    <div className={cn("mx-auto flex w-full flex-col gap-6 p-4 md:p-6 lg:p-8", contentWidthClass)}>
                        {children}
                    </div>
                </main>
            </div>
            {hasContextPanel && (
                <aside className="border-base-300 bg-base-200/20 hidden min-w-0 border-s xl:block xl:min-h-0 xl:overflow-hidden">
                    {contextPanel}
                </aside>
            )}
        </div>
    );
}

export function WorkspaceRouteActions() {
    return null;
}

export function WorkspaceDefaultContextPanel({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return <WorkspaceHealthPanel health={dashboard.health} />;
}
