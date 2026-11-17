import { ListTree } from "lucide-react";
import { useEffect, useId, useMemo, useRef } from "react";
import { useLocation } from "react-router";

import { canonicalRoutePath, dashboardEntryByPath, resolveDashboardEntryTarget } from "@/data/static-route-target";
import type { DashboardDirectory, DashboardEntry, WorkspaceDashboard } from "@/data/workspace-client";
import { DirectoryContents, DirectoryPage } from "@/features/browse/DirectoryPage";
import { PagesList } from "@/features/browse/PagesList";
import { recentlyUpdatedEntries } from "@/features/browse/recent-entries";
import { entryClassifications } from "@/features/navigation/collection-tree";
import { listingCounts, projectedDirectoryListing } from "@/features/navigation/directory-listing";
import { directoryOwners } from "@/features/navigation/directory-owners";
import { navigationSiblings } from "@/features/navigation/navigation-tree";
import { useNavigationTrees } from "@/features/navigation/use-navigation-trees";
import { headerIconButtonClassName, headerIconClassName } from "@/features/workspace/header-controls";
import { EmptyPage } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { useWorkspacePage } from "@/features/workspace/use-workspace-page";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { canonicalEntries, canonicalEntryFor, canonicalEntryRoutePath } from "@/lib/entry-languages";
import { cn } from "@/lib/utils";

import { directoryBreadcrumb, entryDirectoryBreadcrumb } from "./entry-breadcrumb";
import { getEntryOutline } from "./entry-outline";
import { EntryPage } from "./EntryPage";
import { prewarmMarkdownHighlighter } from "./markdown-shiki";

export function DashboardRoute() {
    return <EntryRouteContent routePath="/" />;
}

export function EntryRoute() {
    const location = useLocation();
    return <EntryRouteContent routePath={canonicalRoutePath(location.pathname)} />;
}

function EntryRouteContent({ routePath }: { routePath: string }) {
    const dashboard = useWorkspaceDashboard();
    const { entry: detail } = useWorkspacePage();
    const { files: filesTree } = useNavigationTrees(dashboard);
    const owners = useMemo(
        () => directoryOwners(canonicalEntries(dashboard.entries), dashboard.directories),
        [dashboard],
    );
    const outlineDialogId = useId();
    const outlineDialogRef = useRef<HTMLDialogElement>(null);
    const outlineTriggerRef = useRef<HTMLElement>(null);
    const directory = dashboard.directories.find((candidate) => candidate.routePath === routePath);
    const summaryEntry = directory?.introEntryPath
        ? dashboardEntryByPath(dashboard, directory.introEntryPath)
        : resolveDashboardEntryTarget(dashboard, routePath)?.summary;
    const entry = detail ?? summaryEntry;
    const isEntryDetailLoading = !detail && entry?.body.length === 0;
    const outline = entry ? getEntryOutline(entry.body) : [];
    // A language variant stands in the tree's place of the document it belongs to.
    const treeRoutePath = canonicalEntryRoutePath(dashboard.entries, routePath);

    function openOutlineDialog(trigger: HTMLButtonElement) {
        const dialog = outlineDialogRef.current;
        if (!dialog || dialog.open) return;
        outlineTriggerRef.current = trigger;
        dialog.showModal();
        requestAnimationFrame(() => {
            dialog.querySelector<HTMLAnchorElement>("[data-outline-link]")?.focus();
        });
    }

    useEffect(() => {
        if (entry) void prewarmMarkdownHighlighter();
    }, [entry]);

    useEffect(() => {
        const wideDesktopMedia = window.matchMedia("(min-width: 80rem)");
        const closeDesktopOutlineDialog = () => {
            if (wideDesktopMedia.matches && outlineDialogRef.current?.open) {
                outlineDialogRef.current.close("viewport");
            }
        };

        closeDesktopOutlineDialog();
        wideDesktopMedia.addEventListener("change", closeDesktopOutlineDialog);
        return () => {
            wideDesktopMedia.removeEventListener("change", closeDesktopOutlineDialog);
        };
    }, []);

    useEffect(() => {
        if (outlineDialogRef.current?.open) {
            outlineDialogRef.current.close("navigate");
        }
    }, [routePath]);

    if (!entry) {
        if (directory) return <DirectoryPage directory={directory} />;
        return (
            <WorkspaceRouteFrame title="Not found">
                <EmptyPage />
            </WorkspaceRouteFrame>
        );
    }

    return (
        <WorkspaceRouteFrame
            actions={
                <>
                    {outline.length > 0 ? (
                        <button
                            aria-controls={outlineDialogId}
                            aria-label="Open outline"
                            className={cn(headerIconButtonClassName, "xl:hidden")}
                            onClick={(event) => {
                                openOutlineDialog(event.currentTarget);
                            }}
                            type="button"
                        >
                            <ListTree aria-hidden="true" className={headerIconClassName} />
                        </button>
                    ) : null}
                </>
            }
            reading
            // Home is the workspace crumb itself, so it has no ancestors to show.
            breadcrumb={
                routePath === "/"
                    ? []
                    : directory
                      ? directoryBreadcrumb(directory.path, false, dashboard.directories, owners)
                      : entryDirectoryBreadcrumb(entry, dashboard.directories, owners)
            }
        >
            <EntryPage
                // Home leads the Files tree but is not part of any reading sequence.
                adjacent={routePath === "/" ? undefined : navigationSiblings(filesTree, treeRoutePath)}
                afterBody={
                    routePath === "/" ? (
                        <RecentlyUpdated entries={dashboard.entries} homePath={entry.path} />
                    ) : directory ? (
                        <OwnedDirectory directory={directory} dashboard={dashboard} />
                    ) : undefined
                }
                canonicalLanguage={dashboard.canonicalLanguage}
                classifications={entryClassifications(
                    dashboard.taxonomies,
                    // A language variant is classified through the document it belongs to.
                    canonicalEntryFor(dashboard.entries, entry.path)?.path ?? entry.path,
                )}
                entry={entry}
                entries={dashboard.entries}
                isLoadingDetail={isEntryDetailLoading}
                outline={outline}
                outlineDialogId={outlineDialogId}
                outlineDialogRef={outlineDialogRef}
                onOutlineDialogClose={() => {
                    const trigger = outlineTriggerRef.current;
                    outlineTriggerRef.current = null;
                    requestAnimationFrame(() => {
                        trigger?.focus();
                    });
                }}
                routePath={routePath}
            />
        </WorkspaceRouteFrame>
    );
}

/** The directory listing remains available alongside its selected introduction. */
function OwnedDirectory({ directory, dashboard }: { directory: DashboardDirectory; dashboard: WorkspaceDashboard }) {
    const headingId = useId();
    const listing = projectedDirectoryListing(dashboard, directory);

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-base-300 pt-8">
            <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-semibold" id={headingId}>
                    In this folder
                </h2>
                <span className="text-sm text-base-content/60">{listingCounts(listing)}</span>
            </div>
            <DirectoryContents listing={listing} />
        </section>
    );
}

const recentEntryLimit = 5;

function RecentlyUpdated({ entries, homePath }: { entries: DashboardEntry[]; homePath: string }) {
    const recent = recentlyUpdatedEntries(canonicalEntries(entries), recentEntryLimit, homePath);
    if (recent.length === 0) return null;

    return (
        <section className="flex flex-col gap-3 border-t border-base-300 pt-8">
            <h2 className="text-xl font-semibold">Recently updated</h2>
            <PagesList entries={recent} label="Recently updated" />
        </section>
    );
}
