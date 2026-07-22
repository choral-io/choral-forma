import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
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
    href: string;
    label: string;
    meta: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export function filterQuickOpenItems(items: QuickOpenItem[], query: string, limit = 8) {
    const normalizedQuery = query.trim().toLowerCase();
    return (
        normalizedQuery
            ? items.filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(normalizedQuery))
            : items
    ).slice(0, limit);
}

export function QuickOpenDialog({ className, dashboard, trigger, triggerClassName }: QuickOpenDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const items = [
        { href: "/", label: "Dashboard", meta: "route" },
        { href: "/pages", label: "Pages", meta: "route" },
        ...dashboard.entries.map((entry) => ({ href: entry.routePath, label: entry.title, meta: entry.path })),
        { href: "/spaces", label: "Spaces", meta: "route" },
        ...dashboard.spaces.map((space) => ({
            href: `/spaces/${space.id}`,
            label: space.title,
            meta: space.path,
        })),
        { href: "/views", label: "Views", meta: "route" },
        ...dashboard.views.map((view) => ({ href: viewRoutePath(view.id), label: view.title, meta: view.kind })),
    ];
    const filteredItems = filterQuickOpenItems(items, query);

    function openQuickOpen() {
        dialogRef.current?.showModal();
        requestAnimationFrame(() => inputRef.current?.focus());
    }

    function closeQuickOpen() {
        dialogRef.current?.close();
        setQuery("");
    }

    function openItem(href: string) {
        closeQuickOpen();
        void navigate(href);
    }

    return (
        <>
            <button
                aria-label={trigger === "header" ? "Quick open" : undefined}
                className={cn(
                    trigger === "sidebar" ? "btn btn-ghost w-full justify-start" : "btn btn-square",
                    triggerClassName,
                )}
                onClick={openQuickOpen}
                type="button"
            >
                <Search aria-hidden="true" />
                {trigger === "sidebar" ? <span>Quick open</span> : <span className="sr-only">Quick open</span>}
            </button>

            <dialog
                className={cn("modal modal-top", className)}
                onClose={() => {
                    setQuery("");
                }}
                ref={dialogRef}
            >
                <div className="modal-box mt-12 grid max-h-[calc(100dvh-6rem)] max-w-lg grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">Quick open</h2>
                            <p className="text-base-content/60 mt-1 text-sm">
                                Jump to workspace routes, spaces, pages, and views.
                            </p>
                        </div>
                        <form method="dialog">
                            <button aria-label="Close quick open" className="btn btn-square btn-ghost btn-sm">
                                <X aria-hidden="true" />
                            </button>
                        </form>
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            const firstItem = filteredItems[0];
                            if (firstItem) openItem(firstItem.href);
                        }}
                    >
                        <label className="input w-full">
                            <Search aria-hidden="true" className="size-4 opacity-60" />
                            <input
                                aria-label="Search workspace"
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                        event.preventDefault();
                                        closeQuickOpen();
                                    }
                                }}
                                placeholder="Search workspace..."
                                ref={inputRef}
                                type="search"
                                value={query}
                            />
                        </label>
                    </form>

                    <div className="min-h-0 overflow-y-auto">
                        {filteredItems.length > 0 ? (
                            <ul className="menu w-full gap-1 p-0">
                                {filteredItems.map((item) => (
                                    <li key={item.href}>
                                        <Link
                                            className="flex min-w-0 justify-between gap-3"
                                            onClick={closeQuickOpen}
                                            to={item.href}
                                        >
                                            <span className="min-w-0 truncate font-medium">{item.label}</span>
                                            <span className="text-base-content/60 shrink-0 truncate text-xs">
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
                </div>
                <form className="modal-backdrop" method="dialog">
                    <button aria-label="Close quick open">close</button>
                </form>
            </dialog>
        </>
    );
}

function viewRoutePath(viewId: string) {
    return `/views/${viewId
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;
}
