import { ListTree } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";

import { readPreparedStaticEnhancement } from "@/data/static-enhancement";
import { canonicalRoutePathFromLocation, resolveDashboardEntryTarget } from "@/data/static-route-target";
import type { DashboardEntry } from "@/data/workspace-client";
import { createWorkspaceDashboardContext } from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { DirectoryContents, DirectoryPage } from "@/features/browse/DirectoryPage";
import { PagesList } from "@/features/browse/PagesList";
import { recentlyUpdatedEntries } from "@/features/browse/recent-entries";
import { directoryListing, listingCounts } from "@/features/navigation/directory-listing";
import { directoryOwners } from "@/features/navigation/directory-owners";
import { navigationSiblings } from "@/features/navigation/navigation-tree";
import { useNavigationTrees } from "@/features/navigation/use-navigation-trees";
import { EmptyPage } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { canonicalEntries, canonicalEntryRoutePath } from "@/lib/entry-languages";
import { directoryPathFromRoutePath } from "@/lib/workspace-routes";

import { entryDirectoryBreadcrumb } from "./entry-breadcrumb";
import { getEntryOutline } from "./entry-outline";
import { EntryPage } from "./EntryPage";
import { prewarmMarkdownHighlighter } from "./markdown-shiki";

export function DashboardRoute() {
    return <EntryRouteContent routePath="/" />;
}

export function EntryRoute() {
    const location = useLocation();
    return <EntryRouteContent routePath={canonicalRoutePathFromLocation(location.pathname)} />;
}

function EntryRouteContent({
    entryId: entryIdOverride,
    routePath,
    summaryOverride,
}: {
    entryId?: string;
    routePath: string;
    summaryOverride?: DashboardEntry;
}) {
    const dashboard = useWorkspaceDashboard();
    const dashboardContext = useMemo(() => createWorkspaceDashboardContext(dashboard), [dashboard]);
    const { files: filesTree } = useNavigationTrees(dashboard);
    const owners = useMemo(() => directoryOwners(canonicalEntries(dashboard.entries)), [dashboard.entries]);
    const outlineDialogId = useId();
    const outlineDialogRef = useRef<HTMLDialogElement>(null);
    const outlineTriggerRef = useRef<HTMLElement>(null);
    const target = summaryOverride ? undefined : resolveDashboardEntryTarget(dashboard, routePath);
    const summaryEntry = summaryOverride ?? target?.summary;
    const entryId = entryIdOverride ?? target?.entryId;
    const preparedEntry = readPreparedStaticEnhancement()?.entry;
    const [entryDetail, setEntryDetail] = useState<
        | {
              entry: DashboardEntry;
              routePath: string;
          }
        | undefined
    >(() =>
        preparedEntry?.routePath === routePath
            ? { entry: preparedEntry.detail, routePath: preparedEntry.routePath }
            : undefined,
    );
    const entry = entryDetail?.routePath === routePath ? entryDetail.entry : summaryEntry;
    const isEntryDetailLoading = entryDetail?.routePath !== routePath;
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
        if (!summaryEntry || !entryId || entryDetail?.routePath === routePath) {
            return;
        }

        void prewarmMarkdownHighlighter();
        let cancelled = false;
        workspaceClient
            .getEntry(entryId, dashboardContext)
            .then((result) => {
                if (!cancelled) {
                    setEntryDetail({ entry: result, routePath });
                }
            })
            .catch((error: unknown) => {
                console.warn("Page detail failed to load.", error);
                if (!cancelled) {
                    setEntryDetail({
                        entry: {
                            ...summaryEntry,
                            diagnostics: [
                                ...(summaryEntry.diagnostics ?? []),
                                {
                                    severity: "warning",
                                    code: "entry-detail-load-failed",
                                    message:
                                        error instanceof Error
                                            ? error.message
                                            : "Page detail failed to load from the workspace backend.",
                                    path: summaryEntry.path,
                                },
                            ],
                        },
                        routePath,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [dashboardContext, entryDetail?.routePath, entryId, routePath, summaryEntry]);

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

    // A page route that no document owns names a directory, or nothing.
    const directoryPath = directoryPathFromRoutePath(routePath);
    if (!entry) {
        if (directoryPath !== undefined) return <DirectoryPage path={directoryPath} />;
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
                            className="btn btn-square btn-ghost xl:hidden"
                            onClick={(event) => {
                                openOutlineDialog(event.currentTarget);
                            }}
                            type="button"
                        >
                            <ListTree aria-hidden="true" />
                        </button>
                    ) : null}
                </>
            }
            reading
            // Home is the workspace crumb itself, so it has no ancestors to show.
            breadcrumb={routePath === "/" ? [] : entryDirectoryBreadcrumb(entry, owners)}
        >
            <EntryPage
                // Home leads the Files tree but is not part of any reading sequence.
                adjacent={routePath === "/" ? undefined : navigationSiblings(filesTree, treeRoutePath)}
                afterBody={
                    routePath === "/" ? (
                        <RecentlyUpdated entries={dashboard.entries} homePath={entry.path} />
                    ) : directoryPath ? (
                        <OwnedDirectory
                            directoryPath={directoryPath}
                            entries={dashboard.entries}
                            entryPath={entry.path}
                        />
                    ) : undefined
                }
                canonicalLanguage={dashboard.canonicalLanguage}
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

/**
 * A document served at a directory's route, such as its `index` file, keeps the directory's
 * listing reachable below the document itself.
 */
function OwnedDirectory({
    directoryPath,
    entries,
    entryPath,
}: {
    directoryPath: string;
    entries: DashboardEntry[];
    entryPath: string;
}) {
    const headingId = useId();
    const listing = directoryListing(
        canonicalEntries(entries).filter((candidate) => candidate.path !== entryPath),
        directoryPath,
    );
    if (!listing || (listing.directories.length === 0 && listing.entries.length === 0)) return null;

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
