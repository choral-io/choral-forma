/**
 * Coordinates the application-wide interaction layer while inspectable content
 * is expanded. A lease deliberately owns only shell-level occupancy; each
 * viewer keeps its own rendering, controls, and focus-return behavior.
 */
type WorkspaceInteractionLayerListener = (occupied: boolean) => void;

const leases = new Set<symbol>();
const listeners = new Set<WorkspaceInteractionLayerListener>();

export function acquireWorkspaceInteractionLayer() {
    const lease = Symbol("workspace-interaction-layer");
    let released = false;
    leases.add(lease);
    notifyListeners();

    return () => {
        if (released) {
            return;
        }
        released = true;
        leases.delete(lease);
        notifyListeners();
    };
}

export function subscribeWorkspaceInteractionLayer(listener: WorkspaceInteractionLayerListener) {
    listeners.add(listener);
    listener(leases.size > 0);
    return () => {
        listeners.delete(listener);
    };
}

function notifyListeners() {
    const occupied = leases.size > 0;
    for (const listener of listeners) {
        listener(occupied);
    }
}
