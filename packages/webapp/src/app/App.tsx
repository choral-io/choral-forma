import { useEffect, useState } from "react";
import { Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { WorkspaceSidebar } from "@/features/workspace/WorkspaceSidebar";
import { ThemeProvider } from "./ThemeProvider";

export function App() {
    const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        workspaceClient
            .getDashboard()
            .then((result) => {
                if (!cancelled) {
                    setDashboard(result);
                }
            })
            .catch((reason: unknown) => {
                if (!cancelled) {
                    setError(reason instanceof Error ? reason.message : String(reason));
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (error) {
        return (
            <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
                <div className="border-border bg-card max-w-md rounded-lg border p-6 shadow-sm">
                    <h1 className="text-lg font-semibold">Dashboard failed to load</h1>
                    <p className="text-muted-foreground mt-2 text-sm">{error}</p>
                    <Button
                        className="mt-4"
                        onClick={() => {
                            window.location.reload();
                        }}
                        variant="outline"
                    >
                        Reload
                    </Button>
                </div>
            </main>
        );
    }

    if (!dashboard) {
        return (
            <main className="bg-background text-foreground flex min-h-screen items-center justify-center">
                <div className="border-border bg-card text-muted-foreground rounded-lg border px-4 py-3 text-sm shadow-sm">
                    Loading workspace dashboard...
                </div>
            </main>
        );
    }

    return (
        <ThemeProvider>
            <TooltipProvider>
                <SidebarProvider className="h-svh min-h-0 overflow-hidden">
                    <WorkspaceSidebar dashboard={dashboard} />
                    <SidebarInset className="min-h-0 overflow-hidden">
                        <Outlet context={dashboard} />
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>
        </ThemeProvider>
    );
}
