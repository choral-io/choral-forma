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
    const wasOccupied = leases.size > 0;
    leases.add(lease);
    if (!wasOccupied) {
        notifyListeners();
    }

    return () => {
        if (released) {
            return;
        }
        released = true;
        const wasOccupied = leases.size > 0;
        leases.delete(lease);
        if (wasOccupied && leases.size === 0) {
            notifyListeners();
        }
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
