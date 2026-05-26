import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { mockWorkspaceClient } from "@/data/mock-workspace-client";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { DashboardHome } from "@/features/dashboard/DashboardHome";
import { WorkspaceSidebar } from "@/features/workspace/WorkspaceSidebar";

export function App() {
    const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        mockWorkspaceClient
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
        <div className="bg-background text-foreground flex min-h-screen flex-col lg:flex-row">
            <WorkspaceSidebar dashboard={dashboard} />
            <DashboardHome dashboard={dashboard} />
        </div>
    );
}
