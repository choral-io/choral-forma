import { FolderOpen, HeartPulse, House, LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useLocation } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";

interface WorkspaceSidebarProps {
    collapsible?: boolean;
    dashboard: WorkspaceDashboard;
    onNavigate: () => void;
    showQuickOpen?: boolean;
}

const sidebarStorageKey = "forma.workspaceSidebar";

export function WorkspaceSidebar({
    collapsible = true,
    dashboard,
    onNavigate,
    showQuickOpen = true,
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

    function toggleSidebar() {
        const root = document.documentElement;
        const collapsed = root.dataset.workspaceSidebar !== "collapsed";
        root.dataset.workspaceSidebar = collapsed ? "collapsed" : "expanded";
        try {
            window.localStorage.setItem(sidebarStorageKey, collapsed ? "collapsed" : "expanded");
        } catch {
            // The visual state still works when browser storage is unavailable.
        }
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-visible">
            <div className="border-base-300 flex h-24 shrink-0 items-center gap-3 border-b px-4">
                <img
                    alt=""
                    aria-hidden="true"
                    className="hidden size-9 shrink-0 rounded-lg"
                    data-sidebar-mark
                    src="/favicon.svg"
                />
                <div className="min-w-0 flex-1 text-sm/tight" data-sidebar-label>
                    <p className="truncate text-base font-semibold">Choral Forma</p>
                    <p className="text-base-content/60 mt-1 truncate text-xs">Review Desk</p>
                </div>
            </div>

            <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-x-visible overflow-y-auto px-3 py-5">
                <ul className="menu menu-sm w-full gap-2 p-0">
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

            {collapsible ? (
                <div className="border-base-300 shrink-0 border-t p-3">
                    <button
                        aria-label="Toggle workspace sidebar"
                        className="btn btn-ghost w-full justify-start"
                        data-sidebar-toggle
                        onClick={toggleSidebar}
                        title="Toggle workspace sidebar"
                        type="button"
                    >
                        <PanelLeftClose aria-hidden="true" data-sidebar-collapse-icon />
                        <PanelLeftOpen aria-hidden="true" className="hidden" data-sidebar-expand-icon />
                        <span data-sidebar-label>Collapse sidebar</span>
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
                        ? "menu-active tooltip tooltip-right bg-base-300! text-base-content! focus-visible:ring-base-content/30 h-12! min-h-12! outline-none focus-visible:ring-2"
                        : "tooltip tooltip-right focus-visible:ring-base-content/30 h-12! min-h-12! outline-none focus-visible:ring-2"
                }
                data-tip={label}
                data-sidebar-link
                onClick={onNavigate}
                to={to}
            >
                <Icon aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate" data-sidebar-label>
                    {label}
                </span>
            </Link>
        </li>
    );
}

function taxonomyRoutePath(taxonomyId: string) {
    return `/${encodeURIComponent(taxonomyId)}`;
}
