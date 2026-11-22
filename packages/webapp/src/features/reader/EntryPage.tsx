import { WorkspaceLink as Link } from "@/app/workspace-navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { lazy, Suspense, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";

import type { DashboardDiagnostic, DashboardEntry, WorkspaceHealth } from "@/data/workspace-client";
import { DiagnosticsPanel } from "@/features/diagnostics/DiagnosticsPanel";
import type { EntryClassification } from "@/features/navigation/collection-tree";
import type { NavigationNode } from "@/features/navigation/navigation-tree";
import { SourcePath } from "@/features/workspace/SourcePath";
import { formatAbsoluteDateTime } from "@/lib/date-time";
import { entryLanguageVersions, type EntryLanguageVersion } from "@/lib/entry-languages";
import { scrollReaderAnchor } from "@/lib/reader-anchor-navigation";
import { useRouteContentFocusTarget } from "@/lib/route-focus";

import { getEntryOutlineTree, type EntryOutlineItem } from "./entry-outline";
import { EntryOutlineSection, entryTopId, OutlineFooterNav, OutlineNav, relatedDocumentsId } from "./EntryOutlineNav";
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
    canonicalLanguage,
    classifications = [],
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
    /** The workspace's canonical language, when the read model reports it. */
    canonicalLanguage?: string;
    /** The configured terms that include the document. */
    classifications?: EntryClassification[];
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
    const languageVersions = entryLanguageVersions(entries, entry, canonicalLanguage);
    const outlineTree = getEntryOutlineTree(outline);
    const hasOutline = outlineTree.length > 0;
    const bodyIds = new Set(outline.map((item) => item.id));
    for (const block of entry.body) {
        if (block.type !== "markdown") continue;
        for (const heading of block.anchors ?? block.outline) bodyIds.add(heading.id);
    }
    let topId = entryTopId;
    while (bodyIds.has(topId)) topId += "-";
    let relatedId = relatedDocumentsId;
    while (bodyIds.has(relatedId)) relatedId += "-";
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
            <div className="group/entry mx-auto flex w-full max-w-6xl flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,48rem)_16rem] xl:gap-x-12">
                <div className="mx-auto flex w-full min-w-0 flex-col gap-6 xl:mx-0">
                    <header className="mx-auto flex w-full max-w-3xl scroll-m-8 flex-col gap-3 xl:mx-0" id={topId}>
                        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl" ref={titleRef} tabIndex={-1}>
                            {entry.title}
                        </h1>
                        {entry.summary ? <p className="text-lg/8 text-base-content/70">{entry.summary}</p> : null}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-base-content/60">
                            <time dateTime={entry.updatedAt} title={formatAbsoluteDateTime(entry.updatedAt)}>
                                Updated {entry.updatedLabel}
                            </time>
                            {languageVersions.length > 1 ? <EntryLanguageSwitch versions={languageVersions} /> : null}
                            {classifications.length > 0 ? (
                                <EntryClassifications classifications={classifications} />
                            ) : null}
                            {entry.status !== "healthy" ? (
                                <span className={healthBadgeClass(entry.status)}>{entry.status}</span>
                            ) : null}
                            <SourcePath
                                path={entry.path}
                                to={entry.routePath !== routePath ? entry.routePath : undefined}
                            />
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
                                    <EntryRelatedSection entry={entry} sectionId={relatedId} />
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
                    <aside aria-label="On this page" className="hidden xl:block">
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
                            relatedId={relatedId}
                            routePath={routePath}
                            showBackToTop={pastFirstViewport}
                            topId={topId}
                            tree={outlineTree}
                        />
                    </aside>
                ) : null}
            </div>
            {hasOutline ? (
                <dialog
                    aria-labelledby={`${outlineDialogId}-title`}
                    className="modal modal-end bg-neutral/40 p-0 backdrop-blur-xs outline-none motion-reduce:transition-none xl:hidden"
                    id={outlineDialogId}
                    onCancel={(event) => {
                        event.preventDefault();
                        event.currentTarget.close("cancel");
                    }}
                    onClose={onOutlineDialogClose}
                    ref={outlineDialogRef}
                >
                    <aside
                        aria-labelledby={`${outlineDialogId}-title`}
                        className="modal-box flex h-svh max-h-none w-80 max-w-[calc(100vw-3rem)] flex-col rounded-none bg-base-100 p-0 text-base-content"
                    >
                        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-base-300 p-4">
                            <h2 className="font-semibold" id={`${outlineDialogId}-title`}>
                                Outline
                            </h2>
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
                                relatedId={relatedId}
                                routePath={routePath}
                                showBackToTop={pastFirstViewport}
                                topId={topId}
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

/**
 * Where the document is classified: each taxonomy once, followed by its terms that include the
 * document, each linked to its term page. Groups are separated by a middle dot.
 */
function EntryClassifications({ classifications }: { classifications: EntryClassification[] }) {
    return (
        // An explicit role: Safari drops list semantics from a list whose markers are removed.
        <ul
            aria-label="Classifications"
            className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 wrap-anywhere"
            role="list"
        >
            {classifications.map((classification, index) => (
                <li className="flex max-w-full min-w-0 flex-wrap items-baseline gap-x-1" key={classification.key}>
                    <span>{classification.taxonomyTitle}:</span>
                    {classification.terms.map((term, termIndex) => {
                        const lastTerm = termIndex === classification.terms.length - 1;
                        const punctuation = lastTerm ? (index < classifications.length - 1 ? "\u00a0·" : null) : ",";
                        return (
                            <span key={term.key}>
                                <Link className="link text-base-content/80 link-hover" to={term.to}>
                                    {punctuation ? (
                                        <ClassificationTermLabel punctuation={punctuation} title={term.title} />
                                    ) : (
                                        term.title
                                    )}
                                </Link>
                            </span>
                        );
                    })}
                </li>
            ))}
        </ul>
    );
}

const classificationGraphemes =
    typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : undefined;

function ClassificationTermLabel({ punctuation, title }: { punctuation: string; title: string }) {
    // Ignore break opportunities even when a directional mark or no-break space follows them.
    const suffix = /[\p{White_Space}\p{Cf}]+$/u.exec(title);
    const text = title.slice(0, suffix?.index ?? title.length);
    const trailing = suffix?.[0].replace(/(?:(?![\u00a0\u2007\u202f])\p{White_Space}|\u200b)/gu, "") ?? "";
    // Keep repeated no-break spaces in the label while limiting their visual gap before punctuation.
    const repeatedSpaces = /[\u00a0\u2007\u202f].*[\u00a0\u2007\u202f]/u.test(trailing);
    const end =
        classificationGraphemes?.segment(text).containing(text.length - 1)?.index ??
        text.length - (Array.from(text).at(-1)?.length ?? 0);
    // Keep the final grapheme and the mark together even when the label needs an emergency wrap.
    return (
        <>
            {text.slice(0, end)}
            <span className="whitespace-nowrap">
                {text.slice(end)}
                {repeatedSpaces ? <span className="inline-block max-w-[1em] overflow-clip">{trailing}</span> : trailing}
                <span aria-hidden="true" className="inline-block">
                    {punctuation}
                </span>
            </span>
        </>
    );
}

/** Each language version of the document, named in its own language; the current one is not a link. */
function EntryLanguageSwitch({ versions }: { versions: EntryLanguageVersion[] }) {
    return (
        <nav aria-label="Languages">
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {versions.map((version) => (
                    <li key={version.routePath}>
                        {version.current ? (
                            <span aria-current="page" className="font-medium text-base-content" lang={version.language}>
                                {languageName(version.language)}
                            </span>
                        ) : (
                            <Link
                                className="link link-hover"
                                hrefLang={version.language}
                                lang={version.language}
                                title={version.language}
                                to={version.routePath}
                            >
                                {languageName(version.language)}
                            </Link>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}

function languageName(language: string) {
    try {
        return new Intl.DisplayNames([language], { type: "language" }).of(language) ?? language;
    } catch {
        return language;
    }
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
                    <AdjacentDescription node={adjacent.previous} />
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
                    <AdjacentDescription node={adjacent.next} />
                </Link>
            ) : null}
        </nav>
    );
}

/** Shown when the adjacent document shares its title with a sibling, as the Files tree does. */
function AdjacentDescription({ node }: { node: { description?: string } }) {
    if (!node.description) return null;
    return (
        <span className="max-w-full truncate text-xs text-base-content/60">
            <span className="sr-only">, </span>
            {node.description}
        </span>
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
