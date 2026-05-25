import {
    Bot,
    FileText,
    GitPullRequestDraft,
    LayoutDashboard,
    LibraryBig,
    Search,
    Settings,
    Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { WorkspaceDashboard } from "@/data/workspace-client";

interface WorkspaceSidebarProps {
    dashboard: WorkspaceDashboard;
}

export function WorkspaceSidebar({ dashboard }: WorkspaceSidebarProps) {
    return (
        <aside className="border-border bg-card/85 flex h-screen w-72 shrink-0 flex-col border-r">
            <div className="flex items-center gap-3 p-4">
                <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg text-lg font-semibold">
                    F
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{dashboard.workspaceName}</p>
                    <p className="text-muted-foreground truncate text-xs">Local workspace</p>
                </div>
            </div>
            <div className="px-3">
                <Button className="w-full justify-start" variant="outline">
                    <Search data-icon="inline-start" />
                    Quick open
                </Button>
            </div>
            <ScrollArea className="mt-4 flex-1 px-3">
                <nav className="flex flex-col gap-1">
                    <SidebarItem active icon={LayoutDashboard} label="Dashboard" />
                    <SidebarItem icon={LibraryBig} label="Collections" />
                    <SidebarItem icon={Workflow} label="Views" />
                    <SidebarItem icon={FileText} label="Documents" />
                </nav>
                <Separator className="my-4" />
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            Spaces
                        </span>
                        <Badge variant="secondary">{dashboard.collections.length}</Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                        {dashboard.collections.map((collection) => (
                            <button
                                className="hover:bg-muted focus-visible:ring-ring flex items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                key={collection.id}
                                type="button"
                            >
                                <span className="truncate">{collection.title}</span>
                                <span className="text-muted-foreground text-xs">{collection.entryCount}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <Separator className="my-4" />
                <nav className="flex flex-col gap-1 pb-4">
                    <SidebarItem icon={GitPullRequestDraft} label="Proposals" meta="Draft" />
                    <SidebarItem icon={Bot} label="AI Chat" meta="Preview" />
                    <SidebarItem icon={Settings} label="Settings" />
                </nav>
            </ScrollArea>
        </aside>
    );
}

function SidebarItem({
    active = false,
    icon: Icon,
    label,
    meta,
}: {
    active?: boolean;
    icon: typeof LayoutDashboard;
    label: string;
    meta?: string;
}) {
    return (
        <button
            className={`focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            type="button"
        >
            <Icon data-icon="inline-start" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {meta && <span className="text-muted-foreground text-xs">{meta}</span>}
        </button>
    );
}
