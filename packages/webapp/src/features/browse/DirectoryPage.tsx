import { ChevronRight, Folder } from "lucide-react";
import { Link } from "react-router";

import type { DashboardEntry } from "@/data/workspace-client";
import {
    directoryListing,
    listingCounts,
    pluralCount,
    type DirectoryListing,
    type DirectoryListingFolder,
} from "@/features/navigation/directory-listing";
import { directoryOwners } from "@/features/navigation/directory-owners";
import { directoryBreadcrumb } from "@/features/reader/entry-breadcrumb";
import { EmptyPage, RouteBodySection } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { canonicalEntries } from "@/lib/entry-languages";
import { directoryRoutePath } from "@/lib/workspace-routes";

import { PagesList } from "./PagesList";

/** `/pages`: the workspace root's directory page, titled Files like the sidebar tab that shows the same tree. */
export function PagesRoute() {
    return <DirectoryPage path="" />;
}

/**
 * A directory of indexed source paths: its folders, then its pages. It lists only what the
 * workspace includes, so a folder stands for its indexed pages, not its full contents.
 */
export function DirectoryPage({ path }: { path: string }) {
    const dashboard = useWorkspaceDashboard();
    const entries = canonicalEntries(dashboard.entries);
    const listing = directoryListing(entries, path);

    if (!listing) {
        return (
            <WorkspaceRouteFrame breadcrumb={directoryBreadcrumb("", false)} contentWidth="narrow" title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    const isRoot = listing.path === "";
    return (
        <WorkspaceRouteFrame
            breadcrumb={isRoot ? [] : directoryBreadcrumb(listing.path, false, directoryOwners(entries))}
            contentWidth="narrow"
            description={
                isRoot
                    ? "Pages the workspace includes, grouped by the directories of their source paths."
                    : `Pages the workspace includes under ${listing.path}/.`
            }
            title={isRoot ? "Files" : (listing.path.split("/").at(-1) ?? listing.path)}
        >
            <RouteBodySection meta={listingCounts(listing)}>
                <DirectoryContents listing={listing} />
            </RouteBodySection>
        </WorkspaceRouteFrame>
    );
}

/** A listing's folders and pages, for a directory page or a document served at a directory's route. */
export function DirectoryContents({ listing }: { listing: DirectoryListing<DashboardEntry> }) {
    return (
        <>
            {listing.directories.length > 0 ? <FolderList folders={listing.directories} /> : null}
            {listing.entries.length > 0 ? <PagesList entries={listing.entries} /> : null}
        </>
    );
}

function FolderList({ folders }: { folders: DirectoryListingFolder[] }) {
    return (
        // A labelled list, not a navigation landmark; the explicit role survives removed list markers in Safari.
        <ul aria-label="Folders" className="divide-y divide-base-300 border-y border-base-300" role="list">
            {folders.map((folder) => (
                <li key={folder.path}>
                    <Link
                        className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50"
                        to={directoryRoutePath(folder.path)}
                    >
                        <Folder aria-hidden="true" className="size-5 text-base-content/60" />
                        <span className="flex min-w-0 flex-col" title={folder.path}>
                            <span className="truncate font-medium">{folder.title ?? folder.name}</span>
                            {folder.title ? (
                                <span className="truncate text-xs text-base-content/60">{folder.name}/</span>
                            ) : null}
                        </span>
                        <span className="text-sm text-base-content/60 tabular-nums">
                            {pluralCount(folder.documentCount, "page")}
                        </span>
                        <ChevronRight aria-hidden="true" className="size-5 text-base-content/50" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}
