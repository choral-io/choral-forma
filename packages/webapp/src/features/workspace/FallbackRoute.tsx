import { EmptyPage } from "./RouteContent";
import { WorkspaceRouteFrame } from "./WorkspaceRouteFrame";

export function FallbackRoute() {
    return (
        <WorkspaceRouteFrame contentWidth="narrow" title="Not found">
            <EmptyPage />
        </WorkspaceRouteFrame>
    );
}
