import { FolderOpen, HeartPulse, House, LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useLocation } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";

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
            <div className="border-base-300 flex h-16 shrink-0 items-center gap-3 border-b px-3">
                <img
                    alt=""
                    aria-hidden="true"
                    className="is-drawer-close:block is-drawer-open:hidden hidden size-8 shrink-0 rounded-lg"
                    src="/favicon.svg"
                />
                <div className="is-drawer-close:hidden min-w-0 flex-1 text-sm/tight" data-sidebar-label>
                    <p className="truncate text-base font-semibold">Choral Forma</p>
                    <p className="text-base-content/60 mt-1 truncate text-xs">Review Desk</p>
                </div>
            </div>

            <nav aria-label="Workspace" className="is-drawer-close:overflow-visible min-h-0 flex-1 overflow-y-auto">
                <ul className="menu is-drawer-open:menu-lg w-full grow gap-0.5">
                    {showQuickOpen ? (
                        <li data-sidebar-quick-open>
                            <QuickOpenDialog dashboard={dashboard} trigger="sidebar" />
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

            {collapsible && toggleId ? (
                <div
                    className="border-base-300 is-drawer-close:tooltip is-drawer-close:tooltip-right shrink-0 border-t p-2"
                    data-tip="Expand sidebar"
                >
                    <button
                        aria-label="Toggle workspace sidebar"
                        className="btn btn-circle btn-ghost btn-sm"
                        data-sidebar-toggle
                        onClick={() => {
                            const toggle = document.getElementById(toggleId);
                            if (toggle instanceof HTMLInputElement) toggle.click();
                        }}
                        title="Toggle workspace sidebar"
                        type="button"
                    >
                        <PanelLeftClose aria-hidden="true" className="is-drawer-close:hidden size-4" />
                        <PanelLeftOpen aria-hidden="true" className="is-drawer-open:hidden size-4" />
                    </button>
                </div>
            ) : null}
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
                className={
                    active
                        ? "menu-active is-drawer-close:tooltip is-drawer-close:tooltip-right bg-base-300! text-base-content! focus-visible:ring-base-content/30 flex! items-center gap-3 outline-none focus-visible:ring-2 max-lg:min-h-11"
                        : "is-drawer-close:tooltip is-drawer-close:tooltip-right focus-visible:ring-base-content/30 flex! items-center gap-3 outline-none focus-visible:ring-2 max-lg:min-h-11"
                }
                data-tip={label}
                data-sidebar-link
                onClick={onNavigate}
                to={to}
            >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="is-drawer-close:hidden min-w-0 flex-1 truncate" data-sidebar-label>
                    {label}
                </span>
            </Link>
        </li>
    );
}

function taxonomyRoutePath(taxonomyId: string) {
    return `/${encodeURIComponent(taxonomyId)}`;
}
