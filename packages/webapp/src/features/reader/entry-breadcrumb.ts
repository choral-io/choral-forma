import type { WorkspaceBreadcrumb } from "@/features/workspace/WorkspaceRouteFrame";

/**
 * The directories that contain an entry, outermost first. Directories only group
 * entries, so none of them is a destination.
 */
export function entryDirectoryBreadcrumb(path: string): WorkspaceBreadcrumb[] {
    return path
        .split("/")
        .slice(0, -1)
        .filter((segment) => segment.length > 0)
        .map((label) => ({ label }));
}
