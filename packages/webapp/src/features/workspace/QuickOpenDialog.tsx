import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { cn } from "@/lib/utils";
import { taxonomyRoutePath, taxonomyTermRoutePath, viewRoutePath } from "@/lib/workspace-routes";

interface QuickOpenTriggerProps {
    className?: string;
    onBeforeOpen?: (trigger: HTMLButtonElement) => void;
    trigger: "fab" | "header" | "sidebar";
}

export const quickOpenDialogId = "workspace-quick-open";

export interface QuickOpenItem {
    group: string;
    href: string;
    keywords?: string;
    label: string;
    meta: string;
}

interface QuickOpenCompositionEvent {
    isComposing: boolean;
    keyCode?: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export function filterQuickOpenItems(items: QuickOpenItem[], query: string, limit = 12) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items.slice(0, limit);

    const queryTokens = normalizedQuery.split(/\s+/u);
    return items
        .map((item, index) => ({ index, item, score: quickOpenMatchScore(item, normalizedQuery, queryTokens) }))
        .filter((result) => result.score < Number.POSITIVE_INFINITY)
        .sort((left, right) => left.score - right.score || left.index - right.index)
        .slice(0, limit)
        .map((result) => result.item);
}

// eslint-disable-next-line react-refresh/only-export-components
export function isQuickOpenComposing(event: QuickOpenCompositionEvent) {
    return event.isComposing || event.keyCode === 229;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getQuickOpenActiveIndex(key: string, activeIndex: number, itemCount: number) {
    const lastIndex = Math.max(itemCount - 1, 0);

    if (key === "ArrowDown") return Math.min(activeIndex + 1, lastIndex);
    if (key === "ArrowUp") return Math.max(activeIndex - 1, 0);
    if (key === "Home") return 0;
    if (key === "End") return lastIndex;
    return undefined;
}

function quickOpenMatchScore(item: QuickOpenItem, query: string, queryTokens: string[]) {
    const label = item.label.toLowerCase();
    const meta = item.meta.toLowerCase();
    const haystack = `${label} ${meta} ${item.group} ${item.keywords ?? ""}`.toLowerCase();
    if (!queryTokens.every((token) => haystack.includes(token))) return Number.POSITIVE_INFINITY;
    if (label === query) return 0;
    if (label.startsWith(query)) return 1;
    if (label.split(/\s+/u).some((word) => word.startsWith(query))) return 2;
    if (label.includes(query)) return 3;
    if (meta.startsWith(query)) return 4;
    if (meta.includes(query)) return 5;
    return 6;
}

export function QuickOpenTrigger({ className, onBeforeOpen, trigger }: QuickOpenTriggerProps) {
    const isSidebarTrigger = trigger === "sidebar";
    const isFabTrigger = trigger === "fab";
    const openDialog = (triggerElement: HTMLButtonElement) => {
        onBeforeOpen?.(triggerElement);
        openQuickOpenDialog();
    };

    if (isFabTrigger) {
        return (
            <button
                aria-controls={quickOpenDialogId}
                aria-haspopup="dialog"
                aria-keyshortcuts="Control+K Meta+K"
                aria-label="Quick open"
                className={cn("btn btn-circle btn-lg btn-neutral", className)}
                onClick={(event) => {
                    openDialog(event.currentTarget);
                }}
                type="button"
            >
                <Search aria-hidden="true" className="size-5" />
            </button>
        );
    }

    return (
        <button
            aria-controls={quickOpenDialogId}
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            aria-label="Quick open"
            className={cn(
                isSidebarTrigger
                    ? "is-drawer-close:tooltip is-drawer-close:tooltip-right focus-visible:ring-base-content/30 gap-3 leading-5 outline-none focus-visible:ring-2"
                    : "btn btn-square btn-ghost",
                className,
            )}
            data-tip={isSidebarTrigger ? "Quick open (⌘ K)" : undefined}
            onClick={(event) => {
                openDialog(event.currentTarget);
            }}
            title={trigger === "header" ? "Quick open (Ctrl/⌘ K)" : undefined}
            type="button"
        >
            <Search aria-hidden="true" className={isSidebarTrigger ? "size-5 shrink-0" : undefined} />
            {isSidebarTrigger ? (
                <>
                    <span className="is-drawer-close:hidden min-w-0 truncate" data-sidebar-label>
                        Quick open
                    </span>
                    <kbd className="kbd kbd-xs is-drawer-close:hidden shrink-0" data-sidebar-label>
                        ⌘ K
                    </kbd>
                </>
            ) : (
                <span className="sr-only">Quick open</span>
            )}
        </button>
    );
}

export function QuickOpenDialog({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(0);
    const [query, setQuery] = useState("");
    const routeItems = [
        { group: "Navigate", href: "/", label: "Home", meta: "route" },
        { group: "Navigate", href: "/views", label: "Views", meta: "route" },
        { group: "Navigate", href: "/browse", label: "Browse", meta: "route" },
        { group: "Navigate", href: "/health", label: "Health", meta: "route" },
    ];
    const viewItems = dashboard.views.map((view) => ({
        group: "Views",
        href: viewRoutePath(view.id),
        keywords: view.id,
        label: view.title,
        meta: view.kind,
    }));
    const taxonomyItems = dashboard.taxonomies.flatMap((taxonomy) => [
        {
            group: "Taxonomies",
            href: taxonomyRoutePath(taxonomy.id),
            keywords: taxonomy.id,
            label: taxonomy.title,
            meta: `${String(taxonomy.terms.length)} terms`,
        },
        ...taxonomy.terms.map((term) => ({
            group: taxonomy.title,
            href: taxonomyTermRoutePath(taxonomy.id, term.id),
            keywords: `${taxonomy.id} ${term.id}`,
            label: term.title,
            meta: `${String(term.entryCount)} ${term.entryCount === 1 ? "page" : "pages"}`,
        })),
    ]);
    const entryItems = dashboard.entries.map((entry) => ({
        group: "Content",
        href: entry.routePath,
        keywords: `${entry.kind ?? ""} ${entry.space}`,
        label: entry.title,
        meta: entry.path,
    }));
    const items = [...routeItems, ...viewItems, ...taxonomyItems, ...entryItems];
    const recentEntryItems = [...dashboard.entries]
        .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
        .slice(0, 6)
        .map((entry) => ({
            group: "Recent content",
            href: entry.routePath,
            keywords: `${entry.kind ?? ""} ${entry.space}`,
            label: entry.title,
            meta: entry.path,
        }));
    const filteredItems = query.trim()
        ? filterQuickOpenItems(items, query, 30)
        : [...routeItems, ...viewItems, ...recentEntryItems];
    const activeItem = filteredItems[activeIndex];

    useEffect(() => {
        document.getElementById(quickOpenOptionId(listId, activeIndex))?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, listId]);

    useEffect(() => {
        function handleQuickOpenShortcut(event: KeyboardEvent) {
            if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return;
            event.preventDefault();
            setActiveIndex(0);
            setQuery("");
            if (dialogRef.current?.open) {
                dialogRef.current.close();
            } else {
                dialogRef.current?.showModal();
                requestAnimationFrame(() => inputRef.current?.focus());
            }
        }

        window.addEventListener("keydown", handleQuickOpenShortcut);
        return () => {
            window.removeEventListener("keydown", handleQuickOpenShortcut);
        };
    }, []);

    function closeQuickOpen() {
        dialogRef.current?.close();
        setActiveIndex(0);
        setQuery("");
    }

    function openItem(href: string) {
        closeQuickOpen();
        void navigate(href);
    }

    return (
        <dialog
            className="modal bg-neutral/40 backdrop-blur-xs motion-reduce:transition-none"
            id={quickOpenDialogId}
            onClose={() => {
                setActiveIndex(0);
                setQuery("");
            }}
            ref={dialogRef}
        >
            <div className="modal-box flex h-[min(44rem,calc(100dvh-4rem))] max-w-2xl flex-col p-0">
                <div className="border-base-300 flex items-start justify-between gap-4 border-b px-6 py-5">
                    <div>
                        <h2 className="text-lg font-semibold">Quick open</h2>
                        <p className="text-base-content/60 mt-1 text-sm">
                            Jump to configured views, taxonomies, and content.
                        </p>
                    </div>
                    <form method="dialog">
                        <button aria-label="Close quick open" className="btn btn-square btn-ghost btn-sm">
                            <X aria-hidden="true" />
                        </button>
                    </form>
                </div>

                <form
                    className="border-base-300 border-b px-6 py-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (activeItem) openItem(activeItem.href);
                    }}
                >
                    <label className="input w-full">
                        <Search aria-hidden="true" className="size-4 opacity-60" />
                        <input
                            aria-activedescendant={activeItem ? quickOpenOptionId(listId, activeIndex) : undefined}
                            aria-autocomplete="list"
                            aria-controls={listId}
                            aria-expanded="true"
                            aria-label="Search workspace"
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setActiveIndex(0);
                            }}
                            onKeyDown={(event) => {
                                if (isQuickOpenComposing(event.nativeEvent)) return;

                                const nextActiveIndex = getQuickOpenActiveIndex(
                                    event.key,
                                    activeIndex,
                                    filteredItems.length,
                                );
                                if (nextActiveIndex !== undefined) {
                                    event.preventDefault();
                                    setActiveIndex(nextActiveIndex);
                                    return;
                                }

                                if (event.key === "Escape") {
                                    event.preventDefault();
                                    closeQuickOpen();
                                } else if (event.key === "Enter") {
                                    event.preventDefault();
                                    if (activeItem) openItem(activeItem.href);
                                }
                            }}
                            placeholder="Search workspace..."
                            data-quick-open-input
                            ref={inputRef}
                            role="combobox"
                            type="search"
                            value={query}
                        />
                    </label>
                </form>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {filteredItems.length > 0 ? (
                        <ul className="menu w-full gap-1 p-0" id={listId} role="listbox">
                            {filteredItems.map((item, index) => (
                                <li key={item.href} role="presentation">
                                    {index === 0 || filteredItems[index - 1]?.group !== item.group ? (
                                        <span
                                            className="text-base-content/50 px-3 pt-3 pb-1 text-xs font-medium tracking-wide uppercase"
                                            role="presentation"
                                        >
                                            {item.group}
                                        </span>
                                    ) : null}
                                    <Link
                                        aria-selected={index === activeIndex}
                                        className={cn(
                                            "flex min-w-0 justify-between gap-3",
                                            index === activeIndex && "menu-active",
                                        )}
                                        id={quickOpenOptionId(listId, index)}
                                        onClick={closeQuickOpen}
                                        onMouseMove={() => {
                                            setActiveIndex(index);
                                        }}
                                        role="option"
                                        to={item.href}
                                    >
                                        <span className="min-w-0 truncate font-medium">{item.label}</span>
                                        <span className="text-base-content/60 hidden max-w-64 shrink-0 truncate text-xs sm:block">
                                            {item.meta}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-box border-base-300 text-base-content/60 border border-dashed px-3 py-8 text-center text-sm">
                            No matching routes.
                        </p>
                    )}
                </div>

                <div className="modal-action border-base-300 text-base-content/60 m-0 justify-between border-t px-6 py-3 text-xs">
                    <span className="flex items-center gap-2">
                        <kbd className="kbd kbd-sm">↑</kbd>
                        <kbd className="kbd kbd-sm">↓</kbd>
                        Navigate
                    </span>
                    <span className="flex items-center gap-2">
                        <kbd className="kbd kbd-sm">Enter</kbd>
                        Open
                        <kbd className="kbd kbd-sm">Esc</kbd>
                        Close
                    </span>
                </div>
            </div>
            <form className="modal-backdrop" method="dialog">
                <button aria-label="Close quick open">close</button>
            </form>
        </dialog>
    );
}

function openQuickOpenDialog() {
    const dialog = document.getElementById(quickOpenDialogId);
    if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
    dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector<HTMLInputElement>("[data-quick-open-input]")?.focus());
}

function quickOpenOptionId(listId: string, index: number) {
    return `${listId}-option-${String(index)}`;
}
