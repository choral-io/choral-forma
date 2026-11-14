import { EmptyPage } from "./RouteContent";
import { WorkspaceRouteFrame } from "./WorkspaceRouteFrame";

export function FallbackRoute() {
    return (
        <WorkspaceRouteFrame title="Not found">
            <EmptyPage />
        </WorkspaceRouteFrame>
    );
}
