import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";

import { WorkspaceHealthPanel } from "./DiagnosticsPanel";

export function HealthRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspaceRouteFrame
            contentWidth="narrow"
            description="Read-only checks for workspace configuration, references, and link structure."
            title="Health"
        >
            <WorkspaceHealthPanel health={dashboard.health} />
        </WorkspaceRouteFrame>
    );
}
