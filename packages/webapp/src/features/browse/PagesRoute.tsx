import { RouteBodySection } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";

import { PagesList } from "./PagesList";

export function PagesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspaceRouteFrame
            contentWidth="narrow"
            description="Every Markdown page indexed in the workspace."
            title="Pages"
        >
            <RouteBodySection meta={`${String(dashboard.entries.length)} pages`}>
                <PagesList entries={dashboard.entries} />
            </RouteBodySection>
        </WorkspaceRouteFrame>
    );
}
