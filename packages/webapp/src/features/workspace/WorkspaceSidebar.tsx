import { FileText, LayoutDashboard, LibraryBig, Workflow } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";

interface WorkspaceSidebarProps {
    dashboard: WorkspaceDashboard;
    onNavigate: () => void;
    showQuickOpen?: boolean;
}

export function WorkspaceSidebar({ dashboard, onNavigate, showQuickOpen = true }: WorkspaceSidebarProps) {
    const { pathname } = useLocation();

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-base-300 flex items-center gap-3 border-b p-4">
                <WorkspaceBrandLogo dashboard={dashboard} />
                <div className="min-w-0 flex-1 text-sm/tight">
                    <p className="truncate font-semibold">{dashboard.workspaceName}</p>
                    <p className="text-base-content/60 truncate text-xs">Local repository workspace</p>
                </div>
            </div>

            <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto p-3">
                <ul className="menu menu-sm w-full gap-1 p-0">
                    {showQuickOpen ? (
                        <li>
                            <QuickOpenDialog dashboard={dashboard} trigger="sidebar" />
                        </li>
                    ) : null}
                    <li>
                        <Link
                            aria-current={pathname === "/" ? "page" : undefined}
                            className={pathname === "/" ? "menu-active" : undefined}
                            onClick={onNavigate}
                            to="/"
                        >
                            <LayoutDashboard aria-hidden="true" />
                            Dashboard
                        </Link>
                    </li>
                    <li>
                        <Link
                            aria-current={pathname.startsWith("/pages") ? "page" : undefined}
                            className={pathname.startsWith("/pages") ? "menu-active" : undefined}
                            onClick={onNavigate}
                            to="/pages"
                        >
                            <FileText aria-hidden="true" />
                            Pages
                        </Link>
                    </li>
                    <li>
                        <details open>
                            <summary>
                                <LibraryBig aria-hidden="true" />
                                Spaces
                            </summary>
                            <ul>
                                <li>
                                    <Link onClick={onNavigate} to="/spaces">
                                        All spaces
                                    </Link>
                                </li>
                                {dashboard.spaces.map((space) => {
                                    const to = `/spaces/${space.id}`;
                                    return (
                                        <li key={space.id}>
                                            <Link
                                                aria-current={pathname === to ? "page" : undefined}
                                                className={pathname === to ? "menu-active" : undefined}
                                                onClick={onNavigate}
                                                to={to}
                                            >
                                                <span className="min-w-0 flex-1 truncate">{space.title}</span>
                                                <span className="text-base-content/60 text-xs tabular-nums">
                                                    {space.entryCount}
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </details>
                    </li>
                    <li>
                        <details open>
                            <summary>
                                <Workflow aria-hidden="true" />
                                Views
                            </summary>
                            <ul>
                                <li>
                                    <Link onClick={onNavigate} to="/views">
                                        All views
                                    </Link>
                                </li>
                                {dashboard.views.map((view) => {
                                    const to = viewRoutePath(view.id);
                                    return (
                                        <li key={view.id}>
                                            <Link
                                                aria-current={pathname === to ? "page" : undefined}
                                                className={pathname === to ? "menu-active" : undefined}
                                                onClick={onNavigate}
                                                to={to}
                                            >
                                                <span className="min-w-0 flex-1 truncate">{view.title}</span>
                                                <span className="text-base-content/60 text-xs">{view.kind}</span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </details>
                    </li>
                </ul>
            </nav>

            <div className="border-base-300 flex items-center gap-3 border-t p-4">
                <div aria-hidden="true" className="avatar avatar-placeholder">
                    <div className="rounded-box bg-neutral text-neutral-content w-9">
                        <span className="text-xs">GU</span>
                    </div>
                </div>
                <div className="min-w-0 flex-1 text-sm/tight">
                    <p className="truncate font-medium">Git user</p>
                    <p className="text-base-content/60 truncate text-xs">git@example.com</p>
                </div>
            </div>
        </div>
    );
}

function viewRoutePath(viewId: string) {
    return `/views/${viewId
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;
}

function WorkspaceBrandLogo({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
    const logo = dashboard.workspaceLogo;
    const canUseLogo = logo !== undefined && failedLogoUrl !== logo.url;
    const initial = dashboard.workspaceName.trim().charAt(0).toLocaleUpperCase() || "F";

    return (
        <div className="rounded-box bg-primary text-primary-content flex size-9 shrink-0 items-center justify-center overflow-hidden font-semibold">
            {canUseLogo ? (
                <img
                    alt={logo.alt}
                    className="size-full object-contain"
                    onError={() => {
                        setFailedLogoUrl(logo.url);
                    }}
                    src={logo.url}
                />
            ) : (
                initial
            )}
        </div>
    );
}
