import { ListTree } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";

import { readPreparedStaticEnhancement } from "@/data/static-enhancement";
import { canonicalRoutePathFromLocation, resolveDashboardEntryTarget } from "@/data/static-route-target";
import type { DashboardEntry } from "@/data/workspace-client";
import { createWorkspaceDashboardContext } from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { EmptyPage } from "@/features/workspace/RouteContent";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";

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
                outline.length > 0 ? (
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
                ) : undefined
            }
            breadcrumb={entryDirectoryBreadcrumb(entry.path)}
        >
            <EntryPage
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
