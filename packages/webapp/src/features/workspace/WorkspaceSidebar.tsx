import { FolderOpen, HeartPulse, House, LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useLocation } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
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
        pathname === "/taxonomies" ||
        pathname === "/pages" ||
        pathname.startsWith("/pages/") ||
        dashboard.taxonomies.some((taxonomy) => {
            const taxonomyPath = taxonomyRoutePath(taxonomy.id);
            return pathname === taxonomyPath || pathname.startsWith(`${taxonomyPath}/`);
        });

    return (
        <div className="flex h-full min-h-0 flex-col overflow-visible">
            <div className="border-base-300 flex h-28 shrink-0 items-center gap-2 border-b px-2">
                <div
                    className={cn("min-w-0 flex-1 px-1 text-sm/tight", collapsible && "is-drawer-close:hidden")}
                    data-sidebar-label
                >
                    <p className="truncate text-base font-semibold">Choral Forma</p>
                    <p className="text-base-content/60 mt-1 truncate text-xs">Review Desk</p>
                </div>
                {collapsible && toggleId ? (
                    <div className="is-drawer-close:flex is-drawer-close:size-full is-drawer-close:flex-col is-drawer-close:items-center is-drawer-close:justify-center is-drawer-close:gap-2 shrink-0">
                        <Link
                            aria-label="Choral Forma home"
                            className="btn btn-square btn-ghost is-drawer-open:hidden"
                            onClick={onNavigate}
                            to="/"
                        >
                            <span
                                aria-hidden="true"
                                className="size-7 bg-(image:--workspace-brand-icon) bg-contain bg-center bg-no-repeat"
                            />
                        </Link>
                        <button
                            aria-label="Toggle workspace sidebar"
                            className="btn btn-square btn-ghost"
                            data-sidebar-toggle
                            onClick={() => {
                                const toggle = document.getElementById(toggleId);
                                if (toggle instanceof HTMLInputElement) toggle.click();
                            }}
                            title="Toggle workspace sidebar"
                            type="button"
                        >
                            <PanelLeftClose aria-hidden="true" className="is-drawer-close:hidden size-5" />
                            <PanelLeftOpen aria-hidden="true" className="is-drawer-open:hidden size-5" />
                        </button>
                    </div>
                ) : null}
            </div>

            <nav aria-label="Workspace" className="is-drawer-close:overflow-visible min-h-0 flex-1 overflow-y-auto">
                <ul className="menu w-full grow gap-0.5">
                    {showQuickOpen ? (
                        <li data-sidebar-quick-open>
                            <QuickOpenTrigger trigger="sidebar" />
                        </li>
                    ) : null}
                    <SidebarLink active={pathname === "/"} icon={House} label="Home" onNavigate={onNavigate} to="/" />
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
                        to="/taxonomies"
                    />
                    <SidebarLink
                        active={pathname === "/health"}
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
    icon: Icon,
    label,
    onNavigate,
    to,
}: {
    active: boolean;
    icon: typeof House;
    label: string;
    onNavigate: () => void;
    to: string;
}) {
    return (
        <li>
            <Link
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                    "is-drawer-close:tooltip is-drawer-close:tooltip-right focus-visible:ring-base-content/30 gap-3 outline-none focus-visible:ring-2",
                    active && "menu-active",
                )}
                data-tip={label}
                data-sidebar-link
                onClick={onNavigate}
                to={to}
            >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="is-drawer-close:hidden min-w-0 truncate" data-sidebar-label>
                    {label}
                </span>
            </Link>
        </li>
    );
}
