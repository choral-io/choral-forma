import { ListTree } from "lucide-react";
import { useEffect, useId, useMemo, useRef } from "react";
import { useLocation } from "react-router";

import { canonicalRoutePath, resolveDashboardEntryTarget } from "@/data/static-route-target";
import type { DashboardEntry } from "@/data/workspace-client";
import { DirectoryPage } from "@/features/browse/DirectoryPage";
import { PagesList } from "@/features/browse/PagesList";
import { recentlyUpdatedEntries } from "@/features/browse/recent-entries";
import { entryClassifications } from "@/features/navigation/collection-tree";
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

import { entryDirectoryBreadcrumb } from "./entry-breadcrumb";
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
    const owners = useMemo(() => directoryOwners(dashboard.directories), [dashboard.directories]);
    const outlineDialogId = useId();
    const outlineDialogRef = useRef<HTMLDialogElement>(null);
    const outlineTriggerRef = useRef<HTMLElement>(null);
    const directory = dashboard.directories.find((candidate) => candidate.routePath === routePath);
    const summaryEntry = resolveDashboardEntryTarget(dashboard, routePath)?.summary;
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

    if (directory) return <DirectoryPage directory={directory} />;
    if (!entry) {
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
            breadcrumb={routePath === "/" ? [] : entryDirectoryBreadcrumb(entry, dashboard.directories, owners)}
        >
            <EntryPage
                // Home leads the Files tree but is not part of any reading sequence.
                adjacent={routePath === "/" ? undefined : navigationSiblings(filesTree, treeRoutePath)}
                afterBody={
                    routePath === "/" ? (
                        <RecentlyUpdated entries={dashboard.entries} homePath={entry.path} />
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
