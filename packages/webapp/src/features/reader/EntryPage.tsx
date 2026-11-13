import { ArrowUp, Check, Copy, X } from "lucide-react";
import { lazy, Suspense, type MouseEvent, type RefObject } from "react";

import { rootAwareHref } from "@/data/static-runtime";
import type { DashboardDiagnostic, DashboardEntry, WorkspaceHealth } from "@/data/workspace-client";
import { DiagnosticsPanel } from "@/features/diagnostics/DiagnosticsPanel";
import { copySourcePath } from "@/lib/copy-source-path";
import { formatAbsoluteDateTime } from "@/lib/date-time";
import { scrollReaderAnchor } from "@/lib/reader-anchor-navigation";
import { useRouteContentFocusTarget } from "@/lib/route-focus";
import { cn } from "@/lib/utils";

import { formatEntrySupportedLanguages } from "./entry-languages";
import { getEntryOutlineTree, type EntryOutlineItem } from "./entry-outline";
import { EntryOutlineSection, OutlineFooterNav, OutlineNav } from "./EntryOutlineNav";
import { EntryReferencesSection } from "./EntryReferences";

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

export function EntryPage({
    entry,
    entries,
    isLoadingDetail,
    outline,
    outlineDialogId,
    outlineDialogRef,
    onOutlineDialogClose,
    routePath,
}: {
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
            <div className="group/entry mx-auto flex w-full max-w-6xl flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,48rem)_16rem] xl:gap-x-12">
                <div className="mx-auto flex w-full min-w-0 flex-col gap-6 xl:mx-0">
                    <header className="mx-auto flex w-full max-w-3xl scroll-m-8 flex-col gap-3 xl:mx-0" id="entry-top">
                        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl" ref={titleRef} tabIndex={-1}>
                            {entry.title}
                        </h1>
                        {entry.summary ? <p className="text-sm/6 text-base-content/60">{entry.summary}</p> : null}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-base-content/60">
                            <span className="flex min-w-0 basis-full items-center gap-1 sm:basis-auto">
                                <code className="min-w-0 break-all">{entry.path}</code>
                                <button
                                    aria-label={`Copy source path ${entry.path}`}
                                    className="btn btn-square shrink-0 btn-ghost btn-xs"
                                    onClick={(event) => {
                                        void copySourcePath(event.currentTarget, entry.path);
                                    }}
                                    type="button"
                                >
                                    <Copy aria-hidden="true" className="size-3.5" data-copy-icon />
                                    <Check aria-hidden="true" className="hidden size-3.5" data-copied-icon />
                                </button>
                            </span>
                            <span>{formatEntrySupportedLanguages(entry)}</span>
                            <time dateTime={entry.updatedAt} title={formatAbsoluteDateTime(entry.updatedAt)}>
                                Updated {entry.updatedLabel}
                            </time>
                            {entry.status !== "healthy" ? (
                                <span className={healthBadgeClass(entry.status)}>{entry.status}</span>
                            ) : null}
                        </div>
                    </header>

                    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-12 xl:mx-0">
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
                                <details
                                    className="collapse-arrow collapse scroll-m-8 border-t border-base-300 group-has-data-reader-loading/entry:hidden"
                                    id="document-details"
                                >
                                    <summary className="collapse-title min-h-0 px-0 py-8">
                                        <span aria-level={2} className="block text-lg font-semibold" role="heading">
                                            Document details
                                        </span>
                                        <span className="mt-1 block text-sm/6 text-base-content/60">
                                            References and checks associated with this entry.
                                        </span>
                                    </summary>
                                    <div className="collapse-content px-0 pb-8">
                                        <div className="flex flex-col gap-8">
                                            <EntryReferencesSection entry={entry} />
                                            {diagnostics.length > 0 ? (
                                                <DiagnosticsPanel
                                                    description="Page-level checks from the current read model."
                                                    diagnostics={diagnostics}
                                                    emptyLabel="No page diagnostics found."
                                                    title="Diagnostics"
                                                />
                                            ) : null}
                                        </div>
                                        <div className={cn("mt-8 flex justify-end", hasOutline && "xl:hidden")}>
                                            <a
                                                className="btn btn-ghost btn-sm"
                                                href={rootAwareHref(`${routePath}#entry-top`)}
                                            >
                                                <ArrowUp aria-hidden="true" className="size-4" />
                                                Back to top
                                            </a>
                                        </div>
                                    </div>
                                </details>
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
                    <aside className="hidden xl:block">
                        <div
                            aria-hidden="true"
                            className="hidden flex-col gap-4 py-4 group-has-data-reader-loading/entry:flex"
                        >
                            <div className="h-5 w-20 skeleton" />
                            <div className="h-3 w-full skeleton" />
                            <div className="h-3 w-4/5 skeleton" />
                            <div className="h-3 w-11/12 skeleton" />
                        </div>
                        <EntryOutlineSection onNavigate={navigateOutline} routePath={routePath} tree={outlineTree} />
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
                            <div>
                                <h2 className="font-semibold">Outline</h2>
                                <p className="mt-1 text-sm text-base-content/60">Headings from the current entry.</p>
                            </div>
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
                            <OutlineNav onNavigate={navigateOutline} routePath={routePath} tree={outlineTree} />
                        </div>
                        <div className="shrink-0 p-2">
                            <OutlineFooterNav onNavigate={navigateOutline} routePath={routePath} />
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
