import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { lazy, Suspense, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Link } from "react-router";

import type { DashboardDiagnostic, DashboardEntry, WorkspaceHealth } from "@/data/workspace-client";
import { DiagnosticsPanel } from "@/features/diagnostics/DiagnosticsPanel";
import type { NavigationNode } from "@/features/navigation/navigation-tree";
import { formatAbsoluteDateTime } from "@/lib/date-time";
import { scrollReaderAnchor } from "@/lib/reader-anchor-navigation";
import { useRouteContentFocusTarget } from "@/lib/route-focus";

import { formatEntrySupportedLanguages } from "./entry-languages";
import { getEntryOutlineTree, type EntryOutlineItem } from "./entry-outline";
import { EntryOutlineSection, entryTopId, OutlineFooterNav, OutlineNav } from "./EntryOutlineNav";
import { EntryRelatedSection, hasRelatedDocuments } from "./EntryRelated";
import { useReadingPosition } from "./reading-position";

const EntryReader = lazy(async () => {
    const module = await import("./EntryReader");
    return { default: module.EntryReader };
});

function getEntryDiagnostics(entry: DashboardEntry): DashboardDiagnostic[] {
    const diagnostics: DashboardDiagnostic[] = [...(entry.diagnostics ?? [])];
    const unresolvedLinks = entry.relations.outgoing.filter((link) => link.kind === "unresolved");

    if (entry.status !== "healthy") {
        diagnostics.push({
            severity: entry.status === "failed" ? "error" : "warning",
            code: "entry-status",
            message: `This entry is marked ${entry.status} in the current read model.`,
            path: entry.path,
        });
    }

    diagnostics.push(
        ...unresolvedLinks.map((link) => ({
            severity: "warning" as const,
            code: "unresolved-link",
            message: `Outgoing reference "${link.label}" is not resolved by the current page index.`,
            path: link.targetPath,
        })),
    );

    return diagnostics;
}

export interface AdjacentEntries {
    previous?: NavigationNode;
    next?: NavigationNode;
}

export function EntryPage({
    adjacent,
    afterBody,
    entry,
    entries,
    isLoadingDetail,
    outline,
    outlineDialogId,
    outlineDialogRef,
    onOutlineDialogClose,
    routePath,
}: {
    adjacent?: AdjacentEntries;
    /** Content that follows the document body, ahead of its related documents. */
    afterBody?: ReactNode;
    entry: DashboardEntry;
    entries: DashboardEntry[];
    isLoadingDetail: boolean;
    outline: EntryOutlineItem[];
    outlineDialogId: string;
    outlineDialogRef: RefObject<HTMLDialogElement | null>;
    onOutlineDialogClose: () => void;
    routePath: string;
}) {
    const titleRef = useRouteContentFocusTarget<HTMLHeadingElement>();
    const diagnostics = getEntryDiagnostics(entry);
    const outlineTree = getEntryOutlineTree(outline);
    const hasOutline = outlineTree.length > 0;
    const contentRef = useRef<HTMLDivElement>(null);
    const { activeHeadingId, pastFirstViewport } = useReadingPosition(
        contentRef,
        outline.map((item) => item.id),
    );
    const backlinkCount = hasRelatedDocuments(entry) ? entry.relations.backlinks.length : undefined;
    const closeOutlineDialog = () => {
        if (outlineDialogRef.current?.open) {
            outlineDialogRef.current.close("navigate");
        }
    };
    const navigateOutline = (event: MouseEvent<HTMLAnchorElement>) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        if (scrollReaderAnchor(event.currentTarget)) {
            event.preventDefault();
        }
        closeOutlineDialog();
    };

    return (
        <div className="w-full">
            <div className="group/entry mx-auto flex w-full max-w-6xl flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,48rem)_16rem] xl:gap-x-12 xl:group-has-[#workspace-focus-mode:checked]/shell:grid-cols-[minmax(0,48rem)] xl:group-has-[#workspace-focus-mode:checked]/shell:justify-center">
                <div className="mx-auto flex w-full min-w-0 flex-col gap-6 xl:mx-0">
                    <header className="mx-auto flex w-full max-w-3xl scroll-m-8 flex-col gap-3 xl:mx-0" id={entryTopId}>
                        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl" ref={titleRef} tabIndex={-1}>
                            {entry.title}
                        </h1>
                        {entry.summary ? <p className="text-lg/8 text-base-content/70">{entry.summary}</p> : null}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-base-content/60">
                            <time dateTime={entry.updatedAt} title={formatAbsoluteDateTime(entry.updatedAt)}>
                                Updated {entry.updatedLabel}
                            </time>
                            <span>{formatEntrySupportedLanguages(entry)}</span>
                            {entry.status !== "healthy" ? (
                                <span className={healthBadgeClass(entry.status)}>{entry.status}</span>
                            ) : null}
                        </div>
                    </header>

                    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-12 xl:mx-0" ref={contentRef}>
                        {isLoadingDetail ? (
                            <EntryContentSkeleton />
                        ) : (
                            <>
                                {/* A local boundary keeps the page header, and with it the focus
                                    target, mounted while the reader chunk loads. */}
                                <Suspense fallback={<EntryContentSkeleton />}>
                                    <EntryReader
                                        blocks={entry.body}
                                        currentPath={entry.path}
                                        currentRoutePath={routePath}
                                        entries={entries}
                                        key={entry.path}
                                        omitLeadingTitle={entry.omitLeadingTitle}
                                        outline={outline}
                                    />
                                </Suspense>
                                <div className="flex flex-col gap-8 group-has-data-reader-loading/entry:hidden">
                                    {afterBody}
                                    <EntryRelatedSection entry={entry} />
                                    {diagnostics.length > 0 ? (
                                        <details className="collapse-arrow collapse border border-base-300">
                                            <summary className="collapse-title font-medium">
                                                Diagnostics
                                                <span className="ms-2 badge badge-sm badge-warning">
                                                    {diagnostics.length}
                                                </span>
                                            </summary>
                                            <div className="collapse-content">
                                                <DiagnosticsPanel
                                                    description="Page-level checks from the current read model."
                                                    diagnostics={diagnostics}
                                                    emptyLabel="No page diagnostics found."
                                                    title="Diagnostics"
                                                />
                                            </div>
                                        </details>
                                    ) : null}
                                    <EntryPager adjacent={adjacent} />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {isLoadingDetail ? (
                    <div aria-hidden="true" className="hidden flex-col gap-4 py-4 xl:flex">
                        <div className="h-5 w-20 skeleton" />
                        <div className="h-3 w-full skeleton" />
                        <div className="h-3 w-4/5 skeleton" />
                        <div className="h-3 w-11/12 skeleton" />
                    </div>
                ) : hasOutline ? (
                    <aside className="hidden xl:block xl:group-has-[#workspace-focus-mode:checked]/shell:hidden">
                        <div
                            aria-hidden="true"
                            className="hidden flex-col gap-4 py-4 group-has-data-reader-loading/entry:flex"
                        >
                            <div className="h-5 w-20 skeleton" />
                            <div className="h-3 w-full skeleton" />
                            <div className="h-3 w-4/5 skeleton" />
                            <div className="h-3 w-11/12 skeleton" />
                        </div>
                        <EntryOutlineSection
                            activeHeadingId={activeHeadingId}
                            backlinkCount={backlinkCount}
                            onNavigate={navigateOutline}
                            routePath={routePath}
                            showBackToTop={pastFirstViewport}
                            tree={outlineTree}
                        />
                    </aside>
                ) : null}
            </div>
            {hasOutline ? (
                <dialog
                    className="modal modal-end bg-neutral/40 p-0 backdrop-blur-xs outline-none motion-reduce:transition-none xl:hidden"
                    id={outlineDialogId}
                    onCancel={(event) => {
                        event.preventDefault();
                        event.currentTarget.close("cancel");
                    }}
                    onClose={onOutlineDialogClose}
                    ref={outlineDialogRef}
                >
                    <aside className="modal-box flex h-svh max-h-none w-80 max-w-[calc(100vw-3rem)] flex-col rounded-none bg-base-100 p-0 text-base-content">
                        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-base-300 p-4">
                            <h2 className="font-semibold">Outline</h2>
                            <button
                                aria-label="Close outline"
                                className="btn btn-square btn-ghost"
                                onClick={closeOutlineDialog}
                                type="button"
                            >
                                <X aria-hidden="true" />
                            </button>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                            <OutlineNav
                                activeHeadingId={activeHeadingId}
                                onNavigate={navigateOutline}
                                routePath={routePath}
                                tree={outlineTree}
                            />
                        </div>
                        <div className="shrink-0 p-2">
                            <OutlineFooterNav
                                backlinkCount={backlinkCount}
                                onNavigate={navigateOutline}
                                routePath={routePath}
                                showBackToTop={pastFirstViewport}
                            />
                        </div>
                    </aside>
                    <form className="modal-backdrop" method="dialog">
                        <button aria-label="Close outline">Close</button>
                    </form>
                </dialog>
            ) : null}
        </div>
    );
}

function EntryPager({ adjacent }: { adjacent?: AdjacentEntries }) {
    if (!adjacent?.previous?.to && !adjacent?.next?.to) return null;
    const linkClassName =
        "flex min-w-0 flex-col gap-1 rounded-box border border-base-300 p-4 outline-none hover:bg-base-200/50 focus-visible:ring-2 focus-visible:ring-primary/40";

    return (
        <nav aria-label="Adjacent documents" className="grid gap-3 sm:grid-cols-2">
            {adjacent.previous?.to ? (
                <Link className={linkClassName} to={adjacent.previous.to}>
                    <span className="flex items-center gap-1 text-xs text-base-content/60">
                        <ArrowLeft aria-hidden="true" className="size-3.5" />
                        Previous
                    </span>
                    <span className="truncate font-medium" title={adjacent.previous.label}>
                        {adjacent.previous.label}
                    </span>
                </Link>
            ) : null}
            {adjacent.next?.to ? (
                <Link className={`${linkClassName} items-end text-end sm:col-start-2`} to={adjacent.next.to}>
                    <span className="flex items-center gap-1 text-xs text-base-content/60">
                        Next
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="max-w-full truncate font-medium" title={adjacent.next.label}>
                        {adjacent.next.label}
                    </span>
                </Link>
            ) : null}
        </nav>
    );
}

function EntryContentSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading page content" className="flex flex-col gap-5 py-4" role="status">
            <div className="h-4 w-full skeleton" />
            <div className="h-4 w-11/12 skeleton" />
            <div className="mt-4 h-7 w-2/5 skeleton" />
            <div className="h-4 w-full skeleton" />
            <div className="h-4 w-4/5 skeleton" />
        </div>
    );
}

function healthBadgeClass(status: WorkspaceHealth) {
    return status === "failed" ? "badge badge-error" : status === "warning" ? "badge badge-warning" : "badge";
}
