import { WorkspaceLink as Link } from "@/app/workspace-navigation";
import { ChevronRight, Folder } from "lucide-react";
import { useMemo } from "react";

import type { DashboardDirectory, DashboardEntry } from "@/data/workspace-client";
import { isStaticWorkspaceClient } from "@/data/workspace-client-source";
import {
    listingCounts,
    pluralCount,
    projectedDirectoryListing,
    type DirectoryListing,
    type DirectoryListingFolder,
} from "@/features/navigation/directory-listing";
import { directoryOwners } from "@/features/navigation/directory-owners";
import { directoryBreadcrumb } from "@/features/reader/entry-breadcrumb";
import { markdownAroundProjection } from "@/features/reader/markdown-renderer";
import { MarkdownReader } from "@/features/reader/MarkdownReader";
import { useMermaidScope } from "@/features/reader/use-mermaid-scope";
import { RouteBodySection } from "@/features/workspace/RouteContent";
import { SourcePath } from "@/features/workspace/SourcePath";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { useRouteContentFocusTarget } from "@/lib/route-focus";

import { PagesList } from "./PagesList";

export function DirectoryPage({ directory }: { directory: DashboardDirectory }) {
    const dashboard = useWorkspaceDashboard();
    const titleRef = useRouteContentFocusTarget<HTMLHeadingElement>();
    const mermaidScope = useMermaidScope(directory.path);
    const { introduction } = directory;
    const before = introduction?.markdownBefore ?? "";
    const after = introduction?.markdownAfter;
    const source = useMemo(
        () =>
            after === undefined ? { markdown: before, boundary: undefined } : markdownAroundProjection(before, after),
        [before, after],
    );
    const listing = projectedDirectoryListing(dashboard, directory);
    const contents = (
        <RouteBodySection meta={listingCounts(listing)}>
            <DirectoryContents listing={listing} />
        </RouteBodySection>
    );

    return (
        <WorkspaceRouteFrame
            breadcrumb={directoryBreadcrumb(
                directory.path,
                false,
                dashboard.directories,
                directoryOwners(dashboard.directories),
            )}
            contentWidth="narrow"
        >
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-normal" ref={titleRef} tabIndex={-1}>
                    {introduction?.title ?? directory.path.split("/").at(-1) ?? directory.path}
                </h1>
                {introduction?.summary ? (
                    <p className="text-base/7 text-base-content/60">{introduction.summary}</p>
                ) : null}
                <SourcePath className="text-base-content/60" path={directory.path} />
            </header>
            {introduction ? (
                <MarkdownReader
                    currentPath={introduction.sourcePath}
                    currentRoutePath={directory.routePath}
                    entries={dashboard.entries}
                    headings={introduction.headings}
                    linkSource={isStaticWorkspaceClient ? "published" : "workspace"}
                    markdown={source.markdown}
                    mermaidScope={mermaidScope}
                    omitLeadingTitle={introduction.omitLeadingTitle}
                    projection={{ boundary: source.boundary, content: contents }}
                />
            ) : (
                contents
            )}
        </WorkspaceRouteFrame>
    );
}

function DirectoryContents({ listing }: { listing: DirectoryListing<DashboardEntry> }) {
    return (
        <>
            {listing.directories.length > 0 ? <FolderList folders={listing.directories} /> : null}
            {listing.entries.length > 0 ? <PagesList entries={listing.entries} /> : null}
            {listing.directories.length === 0 && listing.entries.length === 0 ? (
                <p className="text-sm text-base-content/60">This folder has no included pages.</p>
            ) : null}
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
                        to={folder.routePath}
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
