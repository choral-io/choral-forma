import { ChevronRight, HeartPulse, PanelLeftClose } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { canonicalRoutePathFromLocation } from "@/data/static-route-target";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { collectionIdsContaining } from "@/features/navigation/collection-tree";
import { NavigationTree } from "@/features/navigation/NavigationTree";
import { useNavigationTrees } from "@/features/navigation/use-navigation-trees";
import { FormaBrandIcon } from "@/features/workspace/FormaBrandIcon";
import { QuickOpenTrigger } from "@/features/workspace/QuickOpenDialog";
import { canonicalEntryRoutePath } from "@/lib/entry-languages";
import {
    readCollapsedSidebarSections,
    writeCollapsedSidebarSections,
    type SidebarSection,
} from "@/lib/sidebar-sections-preference";
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
    const [collapsed, setCollapsed] = useState(readCollapsedSidebarSections);

    function toggleSection(section: SidebarSection) {
        const next = new Set(collapsed);
        if (!next.delete(section)) next.add(section);
        writeCollapsedSidebarSections(next);
        setCollapsed(next);
    }

    const sections = [
        { id: "pages", label: "Pages", nodes: trees.pages },
        { id: "workspace", label: "Workspace", nodes: trees.workspace },
    ] satisfies { id: SidebarSection; label: string; nodes: unknown[] }[];
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

            {showQuickOpen ? (
                <ul className="menu w-full shrink-0 pb-0">
                    <li>
                        <QuickOpenTrigger trigger="sidebar" />
                    </li>
                </ul>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col pt-2">
                {sections
                    .filter((section) => section.nodes.length > 0)
                    .map((section) => (
                        <SidebarSectionPanel
                            collapsed={collapsed.has(section.id)}
                            key={section.id}
                            label={section.label}
                            onToggle={() => {
                                toggleSection(section.id);
                            }}
                            primary={section.id === "pages"}
                        >
                            <NavigationTree
                                ariaLabel={section.label}
                                containsCurrentIds={section.id === "workspace" ? containsCurrentIds : undefined}
                                nodes={section.nodes}
                                onNavigate={onNavigate}
                                routePath={routePath}
                            />
                        </SidebarSectionPanel>
                    ))}
            </div>

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

/**
 * A collapsible sidebar section with its own scroll area. The primary section takes the
 * remaining height; the others grow with their content up to a bounded share.
 */
function SidebarSectionPanel({
    children,
    collapsed,
    label,
    onToggle,
    primary,
}: {
    children: ReactNode;
    collapsed: boolean;
    label: string;
    onToggle: () => void;
    primary: boolean;
}) {
    const bodyId = useId();

    return (
        <section
            className={cn(
                "flex min-h-0 flex-col border-t border-base-300 first:border-t-0",
                collapsed ? "shrink-0" : primary ? "flex-1" : "max-h-[45%] shrink-0",
            )}
        >
            <h2 className="shrink-0">
                <button
                    aria-controls={bodyId}
                    aria-expanded={!collapsed}
                    className="flex w-full cursor-pointer items-center gap-1 px-3 py-1.5 text-xs font-semibold tracking-wide text-base-content/70 uppercase outline-none hover:text-base-content focus-visible:ring-2 focus-visible:ring-base-content/30 focus-visible:ring-inset"
                    onClick={onToggle}
                    type="button"
                >
                    <ChevronRight
                        aria-hidden="true"
                        className={cn("size-3.5 shrink-0 motion-safe:transition-transform", !collapsed && "rotate-90")}
                    />
                    {label}
                </button>
            </h2>
            {collapsed ? null : (
                <nav aria-label={label} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto" id={bodyId}>
                    {children}
                </nav>
            )}
        </section>
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
