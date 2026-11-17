import { WorkspaceLink as Link } from "@/app/workspace-navigation";
import { ChevronRight, HeartPulse, PanelLeftClose } from "lucide-react";
import { useId, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "react-router";

import { canonicalRoutePath } from "@/data/static-route-target";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { collectionIdsContaining } from "@/features/navigation/collection-tree";
import { filesDefaultOpenIds, workspaceDefaultOpenIds } from "@/features/navigation/navigation-tree";
import { NavigationTree } from "@/features/navigation/NavigationTree";
import { useNavigationTrees } from "@/features/navigation/use-navigation-trees";
import { FormaBrandIcon } from "@/features/workspace/FormaBrandIcon";
import { headerIconButtonClassName, headerIconClassName } from "@/features/workspace/header-controls";
import { QuickOpenTrigger } from "@/features/workspace/QuickOpenDialog";
import { canonicalEntryRoutePath } from "@/lib/entry-languages";
import {
    collapsedSidebarSections,
    readCollapsedSidebarSections,
    subscribeSidebarSections,
    toggleSidebarSection,
    type SidebarSection,
} from "@/lib/sidebar-sections-preference";
import { cn } from "@/lib/utils";
import { healthRoutePath } from "@/lib/workspace-routes";

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
    const routePath = canonicalEntryRoutePath(dashboard.entries, canonicalRoutePath(pathname));
    const trees = useNavigationTrees(dashboard);
    const currentEntryPath = dashboard.entries.find((entry) => entry.routePath === routePath)?.path;
    const containsCurrentIds = useMemo(
        () => (currentEntryPath ? collectionIdsContaining(dashboard.taxonomies, currentEntryPath) : undefined),
        [currentEntryPath, dashboard.taxonomies],
    );
    const collapsed = collapsedSidebarSections(
        useSyncExternalStore(subscribeSidebarSections, readCollapsedSidebarSections),
    );
    const sections = [
        { id: "files", label: "Files", nodes: trees.files, defaultOpenIds: filesDefaultOpenIds(trees.files) },
        {
            id: "workspace",
            label: "Workspace",
            nodes: trees.workspace,
            defaultOpenIds: workspaceDefaultOpenIds(trees.workspace),
        },
    ] satisfies { id: SidebarSection; label: string; nodes: unknown[]; defaultOpenIds: string[] }[];
    const visibleSections = sections.filter((section) => section.nodes.length > 0);
    const filesExpanded = visibleSections.some((section) => section.id === "files" && !collapsed.has("files"));

    /**
     * Files fills the sidebar while it is expanded, and Workspace keeps a bounded, content-sized
     * panel at the bottom, so expanding directories never moves it. Once Files is collapsed,
     * Workspace grows with its content into the space Files left.
     */
    function sectionSizing(section: SidebarSection) {
        if (collapsed.has(section)) return "shrink-0";
        if (section === "files") return "flex-1";
        return filesExpanded ? "max-h-[45%] shrink-0" : "flex-[0_1_auto]";
    }
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
                        className={cn(headerIconButtonClassName, "shrink-0")}
                        data-sidebar-toggle
                        onClick={() => {
                            const toggle = document.getElementById(toggleId);
                            if (toggle instanceof HTMLInputElement) toggle.click();
                        }}
                        title="Hide workspace sidebar"
                        type="button"
                    >
                        <PanelLeftClose aria-hidden="true" className={headerIconClassName} />
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
                {visibleSections.map((section) => (
                    <SidebarSectionPanel
                        collapsed={collapsed.has(section.id)}
                        key={section.id}
                        label={section.label}
                        onToggle={() => {
                            toggleSidebarSection(section.id);
                        }}
                        sizing={sectionSizing(section.id)}
                    >
                        <NavigationTree
                            containsCurrentIds={section.id === "workspace" ? containsCurrentIds : undefined}
                            defaultOpenIds={section.defaultOpenIds}
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
                        active={routePath === healthRoutePath}
                        badge={healthFindingCount > 0 ? healthFindingCount : undefined}
                        icon={HeartPulse}
                        label="Health"
                        onNavigate={onNavigate}
                        to={healthRoutePath}
                    />
                </ul>
            </nav>
        </div>
    );
}

/** A collapsible sidebar section with its own scroll area; `sizing` sets its share of the height. */
function SidebarSectionPanel({
    children,
    collapsed,
    label,
    onToggle,
    sizing,
}: {
    children: ReactNode;
    collapsed: boolean;
    label: string;
    onToggle: () => void;
    sizing: string;
}) {
    const bodyId = useId();

    return (
        <section className={cn("flex min-h-0 flex-col border-t border-base-300 first:border-t-0", sizing)}>
            <h2 className="shrink-0">
                <button
                    aria-controls={collapsed ? undefined : bodyId}
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
                // `overflow-x-clip`, unlike hidden, is no horizontal scroll container, so revealing or
                // focusing a row can never shift the tree sideways even if a row overflows. The vertical
                // margin insets the scroll area itself, so rows never scroll flush against the section's
                // edges; scroll padding keeps a revealed row the same distance away.
                <nav
                    aria-label={label}
                    className="my-1.5 min-h-0 flex-1 scroll-py-2 overflow-x-clip overflow-y-auto"
                    id={bodyId}
                >
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
