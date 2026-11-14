import {
    CalendarDays,
    ChartGantt,
    ChevronRight,
    Folder,
    Layers3,
    LayoutGrid,
    List,
    SquareKanban,
    Table2,
    Tag,
    Waypoints,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import type { DashboardView } from "@/data/workspace-client";
import { cn } from "@/lib/utils";

import { navigationAncestorIds, type NavigationNode } from "./navigation-tree";

const viewIcons = {
    calendar: CalendarDays,
    gantt: ChartGantt,
    graph: Waypoints,
    kanban: SquareKanban,
    list: List,
    table: Table2,
} satisfies Record<DashboardView["kind"], typeof List>;

interface NavigationTreeProps {
    ariaLabel: string;
    nodes: NavigationNode[];
    onNavigate: () => void;
    /** Canonical route of the current page. */
    routePath: string;
}

/**
 * A navigable tree on daisyUI Menu anatomy. Navigation and disclosure are separate
 * controls, so activating one never performs the other, and a closed branch renders
 * no rows.
 */
export function NavigationTree({ ariaLabel, nodes, onNavigate, routePath }: NavigationTreeProps) {
    const rootRef = useRef<HTMLUListElement>(null);
    const [disclosure, setDisclosure] = useState(() => ({
        open: new Set(navigationAncestorIds(nodes, routePath)),
        revealedRoute: routePath,
    }));

    // Arriving at a route reveals it once; the reader may still collapse those branches afterwards.
    let open = disclosure.open;
    if (disclosure.revealedRoute !== routePath) {
        open = new Set([...disclosure.open, ...(navigationAncestorIds(nodes, routePath) ?? [])]);
        setDisclosure({ open, revealedRoute: routePath });
    }

    useEffect(() => {
        rootRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
    }, [routePath]);

    function toggle(id: string) {
        setDisclosure((current) => {
            const next = new Set(current.open);
            if (!next.delete(id)) next.add(id);
            return { ...current, open: next };
        });
    }

    return (
        <ul aria-label={ariaLabel} className="menu w-full" ref={rootRef}>
            {nodes.map((node) => (
                <NavigationRow
                    key={node.id}
                    node={node}
                    onNavigate={onNavigate}
                    onToggle={toggle}
                    open={open}
                    routePath={routePath}
                />
            ))}
        </ul>
    );
}

function NavigationRow({
    node,
    onNavigate,
    onToggle,
    open,
    routePath,
}: {
    node: NavigationNode;
    onNavigate: () => void;
    onToggle: (id: string) => void;
    open: ReadonlySet<string>;
    routePath: string;
}) {
    const listId = useId();
    const isBranch = node.children !== undefined;
    const isOpen = isBranch && open.has(node.id);
    const isCurrent = node.to === routePath;
    const label = (
        <>
            <NavigationNodeIcon node={node} />
            <span className="min-w-0 flex-1 truncate">{node.label}</span>
        </>
    );
    // daisyUI lays a menu item out as a column grid whose later tracks never shrink,
    // so each item holds one shrinkable child that owns the row's own layout.
    const rowClassName = "flex min-w-0 items-center gap-2";
    const chevron = (
        <ChevronRight
            aria-hidden="true"
            className={cn("size-4 shrink-0 motion-safe:transition-transform", isOpen && "rotate-90")}
        />
    );

    return (
        <li>
            {!isBranch && node.to ? (
                <Link
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn("min-w-0", isCurrent && "menu-active font-medium")}
                    onClick={onNavigate}
                    title={node.title ?? node.label}
                    to={node.to}
                >
                    <span className={rowClassName}>
                        {/* Keeps a leaf's label in line with the labels of sibling branches. */}
                        <span aria-hidden="true" className="size-4 shrink-0" />
                        {label}
                    </span>
                </Link>
            ) : node.to ? (
                <div className={cn("min-w-0 gap-2", isCurrent && "menu-active font-medium")}>
                    <button
                        aria-controls={listId}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.label}`}
                        className="-m-1 shrink-0 cursor-pointer rounded-sm p-1 outline-none hover:bg-base-content/10 focus-visible:ring-2 focus-visible:ring-base-content/30"
                        onClick={() => {
                            onToggle(node.id);
                        }}
                        type="button"
                    >
                        {chevron}
                    </button>
                    <Link
                        aria-current={isCurrent ? "page" : undefined}
                        className={cn(rowClassName, "outline-none focus-visible:underline")}
                        onClick={onNavigate}
                        title={node.title ?? node.label}
                        to={node.to}
                    >
                        {label}
                    </Link>
                </div>
            ) : (
                <button
                    aria-controls={listId}
                    aria-expanded={isOpen}
                    className="min-w-0"
                    onClick={() => {
                        onToggle(node.id);
                    }}
                    title={node.title ?? node.label}
                    type="button"
                >
                    <span className={rowClassName}>
                        {chevron}
                        {label}
                    </span>
                </button>
            )}
            {isOpen && node.children ? (
                <ul id={listId}>
                    {node.children.length > 0 ? (
                        node.children.map((child) => (
                            <NavigationRow
                                key={child.id}
                                node={child}
                                onNavigate={onNavigate}
                                onToggle={onToggle}
                                open={open}
                                routePath={routePath}
                            />
                        ))
                    ) : (
                        <li className="menu-title font-normal">Nothing here yet.</li>
                    )}
                </ul>
            ) : null}
        </li>
    );
}

function NavigationNodeIcon({ node }: { node: NavigationNode }) {
    const className = "size-4 shrink-0";
    if (node.kind === "directory") return <Folder aria-hidden="true" className={className} />;
    if (node.kind === "taxonomy") return <Layers3 aria-hidden="true" className={className} />;
    if (node.kind === "term") return <Tag aria-hidden="true" className={className} />;
    if (node.kind === "views") return <LayoutGrid aria-hidden="true" className={className} />;
    if (node.kind === "view" && node.viewKind) {
        const ViewIcon = viewIcons[node.viewKind];
        return <ViewIcon aria-hidden="true" className={className} />;
    }
    return null;
}
