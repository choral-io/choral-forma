import { HeartPulse, PanelLeftClose } from "lucide-react";
import { useId, useMemo, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";

import { canonicalRoutePathFromLocation } from "@/data/static-route-target";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { collectionIdsContaining } from "@/features/navigation/collection-tree";
import { filesDefaultOpenIds, workspaceDefaultOpenIds } from "@/features/navigation/navigation-tree";
import { NavigationTree } from "@/features/navigation/NavigationTree";
import { useNavigationTrees } from "@/features/navigation/use-navigation-trees";
import { FormaBrandIcon } from "@/features/workspace/FormaBrandIcon";
import { QuickOpenTrigger } from "@/features/workspace/QuickOpenDialog";
import { canonicalEntryRoutePath } from "@/lib/entry-languages";
import {
    readSidebarTab,
    sidebarTabs,
    subscribeSidebarTab,
    writeSidebarTab,
    type SidebarTab,
} from "@/lib/sidebar-tab-preference";
import { cn } from "@/lib/utils";

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
    // A language variant is not in the tree, so its page reveals the document it belongs to.
    const routePath = canonicalEntryRoutePath(dashboard.entries, canonicalRoutePathFromLocation(pathname));
    const trees = useNavigationTrees(dashboard);
    const currentEntryPath = dashboard.entries.find((entry) => entry.routePath === routePath)?.path;
    const containsCurrentIds = useMemo(
        () => (currentEntryPath ? collectionIdsContaining(dashboard.taxonomies, currentEntryPath) : undefined),
        [currentEntryPath, dashboard.taxonomies],
    );
    const tabGroupId = useId();
    const tab = useSyncExternalStore(subscribeSidebarTab, readSidebarTab);
    const nodes = tab === "files" ? trees.files : trees.workspace;
    const healthFindingCount = dashboard.health.findings.filter((finding) => finding.severity !== "info").length;

    return (
        <div
            className={cn(
                "flex h-full min-h-0 flex-col",
                // The collapsible drawer animates its own width; content keeps the full width meanwhile and
                // is clipped rather than squeezed. The dialog can be narrower than that, so content fills it.
                collapsible ? "w-sidebar" : "w-full",
            )}
        >
            <div className="flex h-16 shrink-0 items-center gap-1 border-b border-base-300 px-2">
                <Link
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

            {showQuickOpen ? (
                <ul className="menu w-full shrink-0 pb-0">
                    <li>
                        <QuickOpenTrigger trigger="sidebar" />
                    </li>
                </ul>
            ) : null}

            {/* Two views of the workspace; switching never changes the route. */}
            <fieldset className="tabs-box mx-2 mt-2 tabs grid shrink-0 grid-cols-2 tabs-sm">
                <legend className="sr-only">Sidebar view</legend>
                {sidebarTabs.map((value) => (
                    <input
                        aria-label={tabLabels[value]}
                        checked={tab === value}
                        className="tab"
                        key={value}
                        name={tabGroupId}
                        onChange={() => {
                            writeSidebarTab(value);
                        }}
                        type="radio"
                    />
                ))}
            </fieldset>

            {/* `overflow-x-clip`, unlike hidden, is no horizontal scroll container, so revealing or
                focusing a row can never shift the tree sideways even if a row overflows. */}
            <nav aria-label={tabLabels[tab]} className="min-h-0 flex-1 overflow-x-clip overflow-y-auto pt-1">
                {nodes.length > 0 ? (
                    <NavigationTree
                        containsCurrentIds={tab === "workspace" ? containsCurrentIds : undefined}
                        defaultOpenIds={
                            tab === "workspace" ? workspaceDefaultOpenIds(nodes) : filesDefaultOpenIds(nodes)
                        }
                        // A fresh tree on switching reveals the current page in the newly shown view.
                        key={tab}
                        nodes={nodes}
                        onNavigate={onNavigate}
                        routePath={routePath}
                    />
                ) : (
                    <p className="p-4 text-sm text-base-content/60">{emptyLabels[tab]}</p>
                )}
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

const tabLabels = { files: "Files", workspace: "Workspace" } satisfies Record<SidebarTab, string>;
const emptyLabels = {
    files: "No pages are indexed.",
    workspace: "No taxonomies or Views are configured.",
} satisfies Record<SidebarTab, string>;

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
