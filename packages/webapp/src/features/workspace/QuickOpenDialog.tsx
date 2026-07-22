import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { cn } from "@/lib/utils";

interface QuickOpenDialogProps {
    className?: string;
    dashboard: WorkspaceDashboard;
    trigger: "header" | "sidebar";
    triggerClassName?: string;
}

export interface QuickOpenItem {
    group: string;
    href: string;
    keywords?: string;
    label: string;
    meta: string;
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

export function QuickOpenDialog({ className, dashboard, trigger, triggerClassName }: QuickOpenDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(0);
    const [query, setQuery] = useState("");
    const items = [
        { group: "Navigate", href: "/", label: "Dashboard", meta: "route" },
        { group: "Navigate", href: "/pages", label: "Pages", meta: "route" },
        { group: "Navigate", href: "/views", label: "Views", meta: "route" },
        { group: "Navigate", href: "/taxonomies", label: "Classifications", meta: "route" },
        ...dashboard.views.map((view) => ({
            group: "Views",
            href: viewRoutePath(view.id),
            keywords: view.id,
            label: view.title,
            meta: view.kind,
        })),
        ...dashboard.taxonomies.flatMap((taxonomy) => [
            {
                group: "Classifications",
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
        ]),
        ...dashboard.entries.map((entry) => ({
            group: "Pages",
            href: entry.routePath,
            keywords: `${entry.kind ?? ""} ${entry.space}`,
            label: entry.title,
            meta: entry.path,
        })),
    ];
    const filteredItems = filterQuickOpenItems(items, query, query.trim() ? 30 : 14);
    const activeItem = filteredItems[activeIndex];

    useEffect(() => {
        document.getElementById(quickOpenOptionId(listId, activeIndex))?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, listId]);

    useEffect(() => {
        if (trigger !== "sidebar") return;

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
    }, [trigger]);

    function openQuickOpen() {
        setActiveIndex(0);
        setQuery("");
        dialogRef.current?.showModal();
        requestAnimationFrame(() => inputRef.current?.focus());
    }

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
        <>
            <button
                aria-keyshortcuts="Control+K Meta+K"
                aria-label={trigger === "header" ? "Quick open" : undefined}
                className={cn(
                    trigger === "sidebar" ? "btn btn-ghost w-full justify-start" : "btn btn-square",
                    triggerClassName,
                )}
                onClick={openQuickOpen}
                title="Quick open (Ctrl/⌘ K)"
                type="button"
            >
                <Search aria-hidden="true" />
                {trigger === "sidebar" ? <span>Quick open</span> : <span className="sr-only">Quick open</span>}
            </button>

            {createPortal(
                <dialog
                    className={cn("modal", className)}
                    id={`${listId}-dialog`}
                    onClose={() => {
                        setActiveIndex(0);
                        setQuery("");
                    }}
                    ref={dialogRef}
                >
                    <div className="modal-box flex max-h-[min(44rem,calc(100dvh-2rem))] max-w-2xl flex-col p-0">
                        <div className="border-base-300 flex items-start justify-between gap-4 border-b px-6 py-5">
                            <div>
                                <h2 className="text-lg font-semibold">Quick open</h2>
                                <p className="text-base-content/60 mt-1 text-sm">
                                    Jump to workspace routes, classifications, pages, and views.
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
                                    aria-activedescendant={
                                        activeItem ? quickOpenOptionId(listId, activeIndex) : undefined
                                    }
                                    aria-autocomplete="list"
                                    aria-controls={listId}
                                    aria-expanded="true"
                                    aria-label="Search workspace"
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setActiveIndex(0);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            event.preventDefault();
                                            closeQuickOpen();
                                        } else if (event.key === "Enter") {
                                            event.preventDefault();
                                            if (activeItem) openItem(activeItem.href);
                                        } else if (event.key === "ArrowDown") {
                                            event.preventDefault();
                                            setActiveIndex((index) =>
                                                Math.min(index + 1, Math.max(filteredItems.length - 1, 0)),
                                            );
                                        } else if (event.key === "ArrowUp") {
                                            event.preventDefault();
                                            setActiveIndex((index) => Math.max(index - 1, 0));
                                        } else if (event.key === "Home") {
                                            event.preventDefault();
                                            setActiveIndex(0);
                                        } else if (event.key === "End") {
                                            event.preventDefault();
                                            setActiveIndex(Math.max(filteredItems.length - 1, 0));
                                        }
                                    }}
                                    placeholder="Search workspace..."
                                    ref={inputRef}
                                    role="combobox"
                                    type="search"
                                    value={query}
                                />
                            </label>
                        </form>

                        <div className="min-h-0 overflow-y-auto p-2">
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
                </dialog>,
                document.body,
            )}
        </>
    );
}

function viewRoutePath(viewId: string) {
    return `/views/${viewId
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;
}

function taxonomyRoutePath(taxonomyId: string) {
    return `/${encodeURIComponent(taxonomyId)}`;
}

function taxonomyTermRoutePath(taxonomyId: string, termId: string) {
    return `${taxonomyRoutePath(taxonomyId)}/${encodeURIComponent(termId)}`;
}

function quickOpenOptionId(listId: string, index: number) {
    return `${listId}-option-${String(index)}`;
}
