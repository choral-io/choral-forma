import type { DashboardEntry } from "@/data/workspace-client";
import { directoryLabel } from "@/features/navigation/directory-owners";
import type { WorkspaceBreadcrumb } from "@/features/workspace/WorkspaceRouteFrame";
import { directoryRoutePath } from "@/lib/workspace-routes";

type DirectoryOwners = ReadonlyMap<string, Pick<DashboardEntry, "title">>;

/**
 * `Files` and the directories that contain an entry, outermost first, each opening its
 * directory page. A document that stands for a directory, such as its `index` file, does
 * not link to itself as one of its own ancestors.
 */
export function entryDirectoryBreadcrumb(
    entry: Pick<DashboardEntry, "path" | "routePath">,
    owners: DirectoryOwners = new Map(),
): WorkspaceBreadcrumb[] {
    return directoryBreadcrumb(entry.path.split("/").slice(0, -1).join("/"), true, owners).filter(
        (crumb) => crumb.to !== entry.routePath,
    );
}

/**
 * `Files` and each directory down to `path`, labelled as the Files tree labels them.
 * `includeSelf` adds `path` itself, which a document's breadcrumb needs and a directory's
 * own page does not.
 */
export function directoryBreadcrumb(
    path: string,
    includeSelf: boolean,
    owners: DirectoryOwners = new Map(),
): WorkspaceBreadcrumb[] {
    const segments = path.split("/").filter((segment) => segment.length > 0);
    const ancestors = includeSelf ? segments : segments.slice(0, -1);
    return [
        { label: "Files", to: directoryRoutePath("") },
        ...ancestors.map((_, index) => {
            const ancestorPath = segments.slice(0, index + 1).join("/");
            return { label: directoryLabel(owners, ancestorPath), to: directoryRoutePath(ancestorPath) };
        }),
    ];
}
