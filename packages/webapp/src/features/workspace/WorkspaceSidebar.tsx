import { FolderOpen, HeartPulse, LayoutGrid, PanelLeftClose } from "lucide-react";
import { Link, useLocation } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { FormaBrandIcon } from "@/features/workspace/FormaBrandIcon";
import { QuickOpenTrigger } from "@/features/workspace/QuickOpenDialog";
import { cn } from "@/lib/utils";
import { taxonomyRoutePath } from "@/lib/workspace-routes";

interface WorkspaceSidebarProps {
    collapsible?: boolean;
    dashboard: WorkspaceDashboard;
    onNavigate: () => void;
    showQuickOpen?: boolean;
    toggleId?: string;
}

export function WorkspaceSidebar({
    collapsible = true,
    dashboard,
    onNavigate,
    showQuickOpen = true,
    toggleId,
}: WorkspaceSidebarProps) {
    const { pathname } = useLocation();
    const browseIsActive =
        pathname === "/browse" ||
        pathname === "/pages" ||
        pathname.startsWith("/pages/") ||
        dashboard.taxonomies.some((taxonomy) => {
            const taxonomyPath = taxonomyRoutePath(taxonomy.id);
            return pathname === taxonomyPath || pathname.startsWith(`${taxonomyPath}/`);
        });
    const healthFindingCount = dashboard.health.findings.filter((finding) => finding.severity !== "info").length;

    return (
        <div className="flex h-full min-h-0 w-72 max-w-full flex-col">
            <div className="flex h-16 shrink-0 items-center gap-1 border-b border-base-300 px-2">
                <Link
                    aria-current={pathname === "/" ? "page" : undefined}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-field px-2 py-1.5 outline-none hover:bg-base-300/60 focus-visible:ring-2 focus-visible:ring-base-content/30"
                    data-sidebar-link
                    onClick={onNavigate}
                    title={dashboard.workspaceName}
                    to="/"
                >
                    <FormaBrandIcon className="size-6 shrink-0" />
                    <span className="min-w-0 truncate font-semibold">{dashboard.workspaceName}</span>
                </Link>
                {collapsible && toggleId ? (
                    <button
                        aria-label="Hide workspace sidebar"
                        className="btn btn-square shrink-0 btn-ghost btn-sm"
                        data-sidebar-toggle
                        onClick={() => {
                            const toggle = document.getElementById(toggleId);
                            if (toggle instanceof HTMLInputElement) toggle.click();
                        }}
                        title="Hide workspace sidebar"
                        type="button"
                    >
                        <PanelLeftClose aria-hidden="true" className="size-5" />
                    </button>
                ) : null}
            </div>

            <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto">
                <ul className="menu w-full gap-0.5">
                    {showQuickOpen ? (
                        <li>
                            <QuickOpenTrigger trigger="sidebar" />
                        </li>
                    ) : null}
                    <SidebarLink
                        active={pathname === "/views" || pathname.startsWith("/views/")}
                        icon={LayoutGrid}
                        label="Views"
                        onNavigate={onNavigate}
                        to="/views"
                    />
                    <SidebarLink
                        active={browseIsActive}
                        icon={FolderOpen}
                        label="Browse"
                        onNavigate={onNavigate}
                        to="/browse"
                    />
                </ul>
            </nav>

            <nav aria-label="Workspace status" className="shrink-0 border-t border-base-300">
                <ul className="menu w-full">
                    <SidebarLink
                        active={pathname === "/health"}
                        badge={healthFindingCount > 0 ? healthFindingCount : undefined}
                        icon={HeartPulse}
                        label="Health"
                        onNavigate={onNavigate}
                        to="/health"
                    />
                </ul>
            </nav>
        </div>
    );
}

function SidebarLink({
    active,
    badge,
    icon: Icon,
    label,
    onNavigate,
    to,
}: {
    active: boolean;
    badge?: number;
    icon: typeof HeartPulse;
    label: string;
    onNavigate: () => void;
    to: string;
}) {
    return (
        <li>
            <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                    "gap-3 leading-5 outline-none focus-visible:ring-2 focus-visible:ring-base-content/30",
                    active && "menu-active",
                )}
                data-sidebar-link
                onClick={onNavigate}
                to={to}
            >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {badge === undefined ? null : (
                    <span className="badge badge-sm badge-warning">
                        {badge}
                        <span className="sr-only"> findings need attention</span>
                    </span>
                )}
            </Link>
        </li>
    );
}
