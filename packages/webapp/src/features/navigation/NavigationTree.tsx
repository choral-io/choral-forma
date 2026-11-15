import { ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";

import type { DashboardView } from "@/data/workspace-client";
import { displayColor, displayIconId, displayIcons } from "@/lib/display-icons";
import { cn } from "@/lib/utils";

import { navigationRevealIds, type NavigationNode } from "./navigation-tree";

/** Renderer kinds use the same registry icons as the editor extension's workspace tree. */
const viewIconIds = {
    calendar: "calendar-days",
    gantt: "chart-gantt",
    graph: "network",
    kanban: "kanban",
    list: "list",
    table: "table-properties",
} satisfies Record<DashboardView["kind"], string>;

interface NavigationTreeProps {
    ariaLabel: string;
    /** Rows that hold the current page somewhere other than as the current row, such as its terms. */
    containsCurrentIds?: ReadonlySet<string>;
    nodes: NavigationNode[];
    onNavigate: () => void;
    /** Canonical route of the current page. */
    routePath: string;
}

const noIds: ReadonlySet<string> = new Set();

/**
 * A navigable tree on daisyUI Menu anatomy. Navigation and disclosure are separate
 * controls, so activating one never performs the other, and a closed branch renders
 * no rows.
 */
export function NavigationTree({
    ariaLabel,
    containsCurrentIds = noIds,
    nodes,
    onNavigate,
    routePath,
}: NavigationTreeProps) {
    const rootRef = useRef<HTMLUListElement>(null);
    const [disclosure, setDisclosure] = useState(() => ({
        open: new Set(navigationRevealIds(nodes, routePath)),
        revealedRoute: routePath,
    }));

    // Arriving at a route reveals it once; the reader may still collapse those branches afterwards.
    let open = disclosure.open;
    if (disclosure.revealedRoute !== routePath) {
        open = new Set([...disclosure.open, ...navigationRevealIds(nodes, routePath)]);
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
                    containsCurrentIds={containsCurrentIds}
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
    containsCurrentIds,
    node,
    onNavigate,
    onToggle,
    open,
    routePath,
}: {
    containsCurrentIds: ReadonlySet<string>;
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
    const containsCurrent = !isCurrent && containsCurrentIds.has(node.id);
    const label = (
        <>
            <NavigationNodeIcon node={node} />
            <span className="min-w-0 flex-1 truncate">{node.label}</span>
            {containsCurrent ? (
                <span className="flex shrink-0 items-center" data-contains-current>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
                    <span className="sr-only"> (includes the current page)</span>
                </span>
            ) : null}
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
                        // Names the branch's contents, so it never reads like a page control such as "Expand graph".
                        aria-label={`${isOpen ? "Hide" : "Show"} contents of ${node.label}`}
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
                                containsCurrentIds={containsCurrentIds}
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
    const iconId = nodeIconId(node);
    const Icon = iconId ? displayIcons[iconId] : undefined;
    if (!Icon) return null;
    const color = displayColor(node.display);
    // A configured color is blended toward the theme's text color so it stays legible on both themes.
    const style: CSSProperties | undefined = color
        ? { color: `color-mix(in oklab, ${color} 75%, var(--color-base-content))` }
        : undefined;
    return <Icon aria-hidden="true" className="size-4 shrink-0" style={style} />;
}

/** Defaults follow the editor extension's workspace tree: tags for a taxonomy, a folder for a term, panels for Views. */
function nodeIconId(node: NavigationNode): string | undefined {
    if (node.kind === "directory") return "folder";
    if (node.kind === "taxonomy") return displayIconId(node.display, "tags");
    if (node.kind === "term") return displayIconId(node.display, "folder");
    if (node.kind === "views") return "panels-top-left";
    if (node.kind === "view" && node.viewKind) return viewIconIds[node.viewKind];
    return undefined;
}
