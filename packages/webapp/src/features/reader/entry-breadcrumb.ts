import type { WorkspaceBreadcrumb } from "@/features/workspace/WorkspaceRouteFrame";
import { directoryRoutePath } from "@/lib/workspace-routes";

/** `Pages` and the directories that contain an entry, outermost first, each opening its directory page. */
export function entryDirectoryBreadcrumb(path: string): WorkspaceBreadcrumb[] {
    return directoryBreadcrumb(path.split("/").slice(0, -1).join("/"), true);
}

/**
 * `Pages` and each directory down to `path`. `includeSelf` adds `path` itself, which a
 * document's breadcrumb needs and a directory's own page does not.
 */
export function directoryBreadcrumb(path: string, includeSelf: boolean): WorkspaceBreadcrumb[] {
    const segments = path.split("/").filter((segment) => segment.length > 0);
    const ancestors = includeSelf ? segments : segments.slice(0, -1);
    return [
        { label: "Pages", to: directoryRoutePath("") },
        ...ancestors.map((label, index) => ({ label, to: directoryRoutePath(segments.slice(0, index + 1).join("/")) })),
    ];
}
