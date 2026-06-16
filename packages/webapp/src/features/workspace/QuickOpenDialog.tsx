import { Search } from "lucide-react";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { cn } from "@/lib/utils";

import { getQuickOpenKeyboardAction } from "./quick-open-keyboard";

interface QuickOpenDialogProps {
    className?: string;
    dashboard: WorkspaceDashboard;
    trigger: "header" | "sidebar";
    triggerClassName?: string;
}

export function QuickOpenDialog({ className, dashboard, trigger, triggerClassName }: QuickOpenDialogProps) {
    const navigate = useNavigate();
    const listboxId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [isComposing, setIsComposing] = useState(false);
    const items = [
        { href: "/", label: "Dashboard", meta: "route" },
        { href: "/pages", label: "Pages", meta: "route" },
        ...dashboard.entries.map((entry) => ({
            href: entry.routePath,
            label: entry.title,
            meta: entry.path,
        })),
        { href: "/spaces", label: "Spaces", meta: "route" },
        ...dashboard.spaces.map((space) => ({
            href: `/spaces/${space.id}`,
            label: space.title,
            meta: space.path,
        })),
        { href: "/views", label: "Views", meta: "route" },
        ...dashboard.views.map((view) => ({
            href: `/views/${view.id}`,
            label: view.title,
            meta: view.kind,
        })),
    ];
    const normalizedQuery = query.trim().toLowerCase();
    const filteredItems = normalizedQuery
        ? items.filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(normalizedQuery)).slice(0, 8)
        : items.slice(0, 8);
    const normalizedActiveIndex =
        filteredItems.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), filteredItems.length - 1);
    const activeItem = filteredItems[normalizedActiveIndex];
    const triggerElement =
        trigger === "sidebar" ? (
            <SidebarMenuButton className={triggerClassName} tooltip="Quick open" type="button" variant="outline" />
        ) : (
            <Button aria-label="Quick open" className={triggerClassName} size="icon" type="button" variant="outline" />
        );

    function closeQuickOpen() {
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
    }

    function openItem(href: string) {
        closeQuickOpen();
        void navigate(href);
    }

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setActiveIndex(0);
                    setOpen(true);
                    return;
                }

                closeQuickOpen();
            }}
            open={open}
        >
            <DialogTrigger render={triggerElement}>
                <Search />
                {trigger === "sidebar" ? <span>Quick open</span> : <span className="sr-only">Quick open</span>}
            </DialogTrigger>
            <DialogContent
                className={cn(
                    "max-h-[calc(100dvh-(--spacing(32)))] grid-rows-[auto_auto_auto_minmax(0,1fr)] sm:max-w-lg",
                    className,
                )}
                placement="top"
            >
                <DialogHeader>
                    <DialogTitle>Quick open</DialogTitle>
                    <DialogDescription>Jump to workspace routes, spaces, pages, and views.</DialogDescription>
                </DialogHeader>
                <Input
                    aria-activedescendant={
                        activeItem === undefined ? undefined : `${listboxId}-option-${String(normalizedActiveIndex)}`
                    }
                    aria-controls={listboxId}
                    autoFocus
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                    }}
                    onCompositionEnd={() => {
                        setIsComposing(false);
                    }}
                    onCompositionStart={() => {
                        setIsComposing(true);
                    }}
                    onKeyDown={(event) => {
                        const action = getQuickOpenKeyboardAction({
                            activeIndex: normalizedActiveIndex,
                            itemCount: filteredItems.length,
                            isComposing: isComposing || event.nativeEvent.isComposing,
                            key: event.key,
                        });

                        if (action.kind === "none") {
                            return;
                        }

                        event.preventDefault();
                        if (action.kind === "move") {
                            setActiveIndex(action.activeIndex);
                            return;
                        }

                        const item = filteredItems[action.activeIndex];
                        if (item !== undefined) {
                            openItem(item.href);
                        }
                    }}
                    placeholder="Search workspace..."
                    role="combobox"
                    value={query}
                />
                <div className="flex min-h-0 flex-col gap-1 overflow-auto" id={listboxId} role="listbox">
                    {filteredItems.map((item, index) => (
                        <Link
                            aria-selected={index === normalizedActiveIndex}
                            className={cn(
                                "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3",
                                index === normalizedActiveIndex && "bg-accent text-accent-foreground",
                            )}
                            id={`${listboxId}-option-${String(index)}`}
                            key={item.href}
                            onClick={() => {
                                closeQuickOpen();
                            }}
                            role="option"
                            to={item.href}
                        >
                            <span className="min-w-0 truncate font-medium">{item.label}</span>
                            <span className="text-muted-foreground shrink-0 truncate text-xs">{item.meta}</span>
                        </Link>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="text-muted-foreground rounded-lg border px-3 py-6 text-center text-sm">
                            No matching routes.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
