import type { DashboardDirectory, DashboardEntry } from "@/data/workspace-client";
import { directoryLabel } from "@/features/navigation/directory-owners";
import type { WorkspaceBreadcrumb } from "@/features/workspace/WorkspaceRouteFrame";

type DirectoryOwners = ReadonlyMap<string, { title?: string | null }>;

/**
 * The directories that contain an entry, outermost first, each opening its directory page.
 * The workspace crumb that leads every breadcrumb is the root directory's page, home.
 */
export function entryDirectoryBreadcrumb(
    entry: Pick<DashboardEntry, "path">,
    directories: readonly DashboardDirectory[],
    owners: DirectoryOwners,
): WorkspaceBreadcrumb[] {
    return directoryBreadcrumb(entry.path.split("/").slice(0, -1).join("/"), true, directories, owners);
}

/**
 * Each directory down to `path`, labelled as the Files tree labels them.
 * `includeSelf` adds `path` itself, which a document's breadcrumb needs and a directory's
 * own page does not.
 */
export function directoryBreadcrumb(
    path: string,
    includeSelf: boolean,
    directories: readonly DashboardDirectory[],
    owners: DirectoryOwners,
): WorkspaceBreadcrumb[] {
    const segments = path.split("/").filter((segment) => segment.length > 0);
    const ancestors = includeSelf ? segments : segments.slice(0, -1);
    return ancestors.flatMap((_, index) => {
        const ancestorPath = segments.slice(0, index + 1).join("/");
        const directory = directories.find((candidate) => candidate.path === ancestorPath);
        return directory ? [{ label: directoryLabel(owners, ancestorPath), to: directory.routePath }] : [];
    });
}
