import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { WorkspaceHealthPanel } from "@/features/diagnostics/DiagnosticsPanel";
import { ThemeModeMenu } from "@/features/theme/ThemeModeMenu";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { PanelRightIcon } from "lucide-react";

const CONTEXT_SHEET_DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";

interface WorkspaceRouteFrameProps {
    actions?: ReactNode;
    children: ReactNode;
    contextPanel?: ReactNode;
    dashboard: WorkspaceDashboard;
    mobileContextPanel?: ReactNode;
    contentWidth?: "default" | "fluid" | "readable";
    description?: string;
    eyebrow: string;
    title: string;
}

export function WorkspaceRouteFrame({
    actions,
    children,
    contextPanel,
    dashboard,
    mobileContextPanel,
    contentWidth = "default",
    description,
    eyebrow,
    title,
}: WorkspaceRouteFrameProps) {
    const hasContextPanel = Boolean(contextPanel);
    const drawerContextPanel = mobileContextPanel ?? contextPanel;
    const contentWidthClass = {
        default: "max-w-6xl",
        fluid: "max-w-none",
        readable: "max-w-4xl",
    }[contentWidth];

    return (
        <div
            className={cn(
                "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-auto xl:grid xl:grid-cols-1 xl:overflow-hidden",
                hasContextPanel && "xl:grid-cols-[minmax(0,1fr)_22rem]",
            )}
        >
            <div className="flex min-w-0 flex-col xl:min-h-0">
                <header className="border-border bg-background/90 flex shrink-0 flex-col gap-4 border-b p-4 backdrop-blur-sm md:px-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <SidebarTrigger className="-ms-1 hidden lg:inline-flex" />
                        <div className="min-w-0">
                            <p className="text-muted-foreground text-sm">{eyebrow}</p>
                            <h1 className="truncate text-2xl font-semibold tracking-normal" title={title}>
                                {title}
                            </h1>
                            {description && (
                                <p className="text-muted-foreground mt-1 max-w-3xl text-sm/6">{description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <SidebarTrigger className="lg:hidden" size="icon" variant="outline" />
                        <QuickOpenDialog dashboard={dashboard} trigger="header" triggerClassName="md:hidden" />
                        {hasContextPanel && drawerContextPanel ? (
                            <ContextDrawer panel={drawerContextPanel} title={title} />
                        ) : null}
                        {actions ?? <WorkspaceRouteActions />}
                    </div>
                </header>
                <main className="min-w-0 xl:min-h-0 xl:flex-1 xl:overflow-auto">
                    <div className={cn("mx-auto flex w-full flex-col gap-6 p-4 md:p-6 lg:p-8", contentWidthClass)}>
                        {children}
                    </div>
                </main>
            </div>
            {hasContextPanel && (
                <aside className="border-border bg-muted/20 hidden min-w-0 xl:block xl:min-h-0 xl:overflow-hidden xl:border-s">
                    {contextPanel}
                </aside>
            )}
        </div>
    );
}

function ContextDrawer({ panel, title }: { panel: ReactNode; title: string }) {
    const [open, setOpen] = useState(false);
    const isDesktopContextPanel = useMediaQuery(CONTEXT_SHEET_DESKTOP_MEDIA_QUERY, {
        onChange: (matches) => {
            if (matches) {
                setOpen(false);
            }
        },
    });

    const sheetOpen = open && !isDesktopContextPanel;

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(isDesktopContextPanel ? false : nextOpen);
    };

    return (
        <Sheet open={sheetOpen} onOpenChange={handleOpenChange}>
            <SheetTrigger
                render={<Button aria-label="Open context panel" className="xl:hidden" size="icon" variant="outline" />}
            >
                <PanelRightIcon data-icon="inline-start" />
            </SheetTrigger>
            <SheetContent
                className="w-[min(28rem,calc(100vw-2rem))] gap-0 p-0 sm:max-w-md xl:hidden"
                showCloseButton={false}
                side="right"
            >
                <SheetHeader className="sr-only">
                    <SheetTitle>{title} context</SheetTitle>
                    <SheetDescription>Route context and outline panels.</SheetDescription>
                </SheetHeader>
                {panel}
            </SheetContent>
        </Sheet>
    );
}

export function WorkspaceRouteActions() {
    return <ThemeModeMenu />;
}

export function WorkspaceDefaultContextPanel({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return <WorkspaceHealthPanel health={dashboard.health} />;
}
