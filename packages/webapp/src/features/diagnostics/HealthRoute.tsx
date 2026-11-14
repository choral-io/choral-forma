import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceDefaultContextPanel, WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";

export function HealthRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspaceRouteFrame
            description="Read-only checks for workspace configuration, references, and link structure."
            title="Health"
        >
            <WorkspaceDefaultContextPanel dashboard={dashboard} />
        </WorkspaceRouteFrame>
    );
}
