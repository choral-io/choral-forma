import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

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

interface QuickOpenDialogProps {
    className?: string;
    dashboard: WorkspaceDashboard;
    trigger: "header" | "sidebar";
    triggerClassName?: string;
}

export function QuickOpenDialog({ className, dashboard, trigger, triggerClassName }: QuickOpenDialogProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
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
    const triggerElement =
        trigger === "sidebar" ? (
            <SidebarMenuButton className={triggerClassName} tooltip="Quick open" type="button" variant="outline" />
        ) : (
            <Button aria-label="Quick open" className={triggerClassName} size="icon" type="button" variant="outline" />
        );

    return (
        <Dialog onOpenChange={setOpen} open={open}>
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
                    autoFocus
                    onChange={(event) => {
                        setQuery(event.target.value);
                    }}
                    placeholder="Search workspace..."
                    value={query}
                />
                <div className="flex min-h-0 flex-col gap-1 overflow-auto">
                    {filteredItems.map((item) => (
                        <Link
                            className="hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
                            key={item.href}
                            onClick={() => {
                                setOpen(false);
                                setQuery("");
                            }}
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
