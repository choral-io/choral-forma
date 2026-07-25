import {
    AlertTriangle,
    ArrowRight,
    ArrowUp,
    Check,
    ChevronRight,
    Columns3,
    Copy,
    FileText,
    Layers3,
    List,
    ListTree,
    Network,
    RefreshCw,
    Table2,
    X,
} from "lucide-react";
import {
    lazy,
    Suspense,
    useEffect,
    useId,
    useRef,
    useState,
    type MouseEvent,
    type ReactNode,
    type RefObject,
} from "react";
import { Link, useOutletContext, useParams } from "react-router";

import type {
    DashboardDiagnostic,
    DashboardEntry,
    DashboardEntryBlock,
    DashboardEntryLink,
    DashboardTaxonomy,
    DashboardTaxonomyTerm,
    DashboardViewProjection,
    DashboardViewProjectionItem,
    DashboardViewRender,
    WorkspaceDashboard,
    WorkspaceHealth,
} from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { DiagnosticsPanel } from "@/features/diagnostics/DiagnosticsPanel";
import { WorkspaceDefaultContextPanel, WorkspaceRouteFrame } from "@/features/workspace/WorkspaceRouteFrame";
import { formatAbsoluteDateTime } from "@/lib/date-time";
import { createMermaidRenderScope } from "@/lib/mermaid";
import { scrollReaderAnchor } from "@/lib/reader-anchor-navigation";
import { cn } from "@/lib/utils";
import { taxonomyRoutePath, taxonomyTermRoutePath, viewRoutePath } from "@/lib/workspace-routes";

import { formatEntrySupportedLanguages } from "./entry-languages";
import { prewarmMarkdownHighlighter } from "./markdown-shiki";
import { MarkdownReader } from "./MarkdownReader";

const ViewGraphProjection = lazy(async () => {
    const module = await import("./ViewGraphProjection");
    return { default: module.ViewGraphProjection };
});

function useMermaidScope(key: string) {
    const reactId = useId();
    const [scope] = useState(() => createMermaidRenderScope(`${key}-${reactId}`));
    useEffect(() => {
        return () => {
            scope.dispose();
        };
    }, [scope]);
    return scope;
}

export function DashboardRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            description={`${dashboard.tagline.replace(/[.!?。！？]\s*$/u, "")} • Read-only`}
            eyebrow="Workspace"
            title={dashboard.workspaceName}
        >
            <DashboardPage dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function HealthRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            description="Read-only checks for workspace configuration, references, and link structure."
            eyebrow="Workspace"
            title="Health"
        >
            <WorkspaceDefaultContextPanel dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function PagesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            contextPanel={<PagesContextPanel dashboard={dashboard} />}
            eyebrow="Workspace"
            title="Pages"
        >
            <PagesPage dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function EntryRoute() {
    const dashboard = useWorkspaceDashboard();
    const params = useParams();
    const routePath = `/pages/${params["*"] ?? ""}`;
    const outlineDialogId = useId();
    const outlineDialogRef = useRef<HTMLDialogElement>(null);
    const outlineTriggerRef = useRef<HTMLElement>(null);
    const summaryEntry = dashboard.entries.find((item) => item.routePath === routePath);
    const [entryDetail, setEntryDetail] = useState<
        | {
              entry: DashboardEntry;
              routePath: string;
          }
        | undefined
    >(undefined);
    const entry = entryDetail?.routePath === routePath ? entryDetail.entry : summaryEntry;
    const isEntryDetailLoading = entryDetail?.routePath !== routePath;
    const outline = entry ? getEntryOutline(entry.body) : [];

    function openOutlineDialog(trigger: HTMLButtonElement) {
        const dialog = outlineDialogRef.current;
        if (!dialog || dialog.open) return;
        outlineTriggerRef.current =
            trigger.closest(".fab")?.querySelector<HTMLElement>('[aria-label="Open page actions"]') ?? trigger;
        trigger.blur();
        dialog.showModal();
        requestAnimationFrame(() => {
            dialog.querySelector<HTMLAnchorElement>("[data-outline-link]")?.focus();
        });
    }

    useEffect(() => {
        if (!summaryEntry) {
            return;
        }

        let cancelled = false;
        void prewarmMarkdownHighlighter();
        workspaceClient
            .getEntry(summaryEntry.id)
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
    }, [routePath, summaryEntry]);

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
            <WorkspacePageShell eyebrow="Pages" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    return (
        <WorkspacePageShell
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
            contentWidth="default"
            description={entry.title}
            eyebrow="Workspace"
            fabActions={
                outline.length > 0 ? (
                    <button
                        aria-controls={outlineDialogId}
                        aria-label="Outline"
                        className="btn btn-circle btn-lg btn-neutral"
                        onClick={(event) => {
                            openOutlineDialog(event.currentTarget);
                        }}
                        type="button"
                    >
                        <ListTree aria-hidden="true" className="size-5" />
                    </button>
                ) : undefined
            }
            title="Pages"
            titleAs="div"
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
            />
        </WorkspacePageShell>
    );
}

export function TaxonomiesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            description="Taxonomies and terms declared by workspace configuration."
            eyebrow="Workspace"
            title="Browse"
        >
            <TaxonomiesPage dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function TaxonomyRoute() {
    const dashboard = useWorkspaceDashboard();
    const { taxonomyId } = useParams();
    const taxonomy = dashboard.taxonomies.find((item) => item.id === taxonomyId);

    if (!taxonomy) {
        return (
            <WorkspacePageShell eyebrow="Browse" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    return (
        <WorkspacePageShell description={taxonomy.description} eyebrow="Browse" title={taxonomy.title}>
            <TaxonomyPage taxonomy={taxonomy} />
        </WorkspacePageShell>
    );
}

export function TaxonomyTermRoute() {
    const dashboard = useWorkspaceDashboard();
    const { taxonomyId, termId } = useParams();
    const taxonomy = dashboard.taxonomies.find((item) => item.id === taxonomyId);
    const term = taxonomy?.terms.find((item) => item.id === termId);

    if (!taxonomy || !term) {
        return (
            <WorkspacePageShell eyebrow="Browse" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    return (
        <WorkspacePageShell description={term.description} eyebrow={taxonomy.title} title={term.title}>
            <TaxonomyTermPage taxonomy={taxonomy} term={term} />
        </WorkspacePageShell>
    );
}

export function ViewsRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            description="Read-only projections declared by workspace configuration."
            eyebrow="Workspace"
            title="Views"
        >
            <ViewsPage dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function ViewRoute() {
    const dashboard = useWorkspaceDashboard();
    const params = useParams();
    const viewId = params["*"];
    const view = dashboard.views.find((item) => item.id === viewId);
    const [renderRequestVersion, setRenderRequestVersion] = useState(0);
    const [renderState, setRenderState] = useState<
        | {
              render: DashboardViewRender;
              status: "ready";
              viewId: string;
          }
        | {
              message: string;
              status: "error";
              viewId: string;
          }
        | undefined
    >(undefined);

    useEffect(() => {
        if (!viewId) {
            return;
        }

        let cancelled = false;
        workspaceClient
            .getViewRender(viewId)
            .then((render) => {
                if (!cancelled) {
                    setRenderState({ render, status: "ready", viewId });
                }
            })
            .catch((error: unknown) => {
                console.warn("View projection failed to load.", error);
                if (!cancelled) {
                    setRenderState({
                        message: error instanceof Error ? error.message : "The workspace backend returned an error.",
                        status: "error",
                        viewId,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [renderRequestVersion, viewId]);

    if (!view) {
        return (
            <WorkspacePageShell eyebrow="Views" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    const currentRenderState = renderState?.viewId === viewId ? renderState : undefined;
    const render = currentRenderState?.status === "ready" ? currentRenderState.render : undefined;
    const renderError = currentRenderState?.status === "error" ? currentRenderState.message : undefined;

    return (
        <WorkspacePageShell
            contentWidth={view.kind === "list" ? "readable" : "fluid"}
            description={view.description}
            eyebrow="Views"
            title={view.title}
        >
            <ViewPage
                dashboard={dashboard}
                key={viewId}
                onRetry={() => {
                    setRenderState(undefined);
                    setRenderRequestVersion((version) => version + 1);
                }}
                render={render}
                renderError={renderError}
                view={view}
            />
        </WorkspacePageShell>
    );
}

export function FallbackRoute() {
    return (
        <WorkspacePageShell eyebrow="Workspace" title="Not found">
            <EmptyPage />
        </WorkspacePageShell>
    );
}

function useWorkspaceDashboard() {
    return useOutletContext<WorkspaceDashboard>();
}

function WorkspacePageShell({
    actions,
    children,
    contextPanel,
    contentWidth,
    description,
    eyebrow,
    fabActions,
    title,
    titleAs,
}: {
    actions?: ReactNode;
    children: ReactNode;
    contextPanel?: ReactNode;
    contentWidth?: "default" | "fluid" | "readable";
    description?: string;
    eyebrow: string;
    fabActions?: ReactNode;
    title: string;
    titleAs?: "div" | "h1";
}) {
    return (
        <WorkspaceRouteFrame
            actions={actions}
            contextPanel={contextPanel}
            contentWidth={contentWidth}
            description={description}
            eyebrow={eyebrow}
            fabActions={fabActions}
            title={title}
            titleAs={titleAs}
        >
            {children}
        </WorkspaceRouteFrame>
    );
}

function DashboardPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const recentEntries = [...dashboard.entries]
        .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
        .slice(0, 5);
    const healthFindings = dashboard.health.findings;

    return (
        <div className="flex flex-col gap-12">
            <section>
                <div>
                    <h2 className="text-lg font-semibold">Configured views</h2>
                    <p className="text-base-content/60 mt-1 text-sm/6">
                        Start with a configured projection to review the workspace from a useful angle.
                    </p>
                </div>
                {dashboard.views.length > 0 ? (
                    <nav aria-label="Configured views" className="mt-4">
                        <div className="divide-base-300 divide-y">
                            {dashboard.views.map((view) => (
                                <Link
                                    className="hover:bg-base-200/50 focus-visible:ring-base-content/30 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none focus-visible:ring-2"
                                    key={view.id}
                                    to={viewRoutePath(view.id)}
                                >
                                    <span className="bg-base-200 text-base-content/60 flex size-10 items-center justify-center rounded-md">
                                        {view.kind === "kanban" ? (
                                            <Columns3 aria-hidden="true" />
                                        ) : view.kind === "table" ? (
                                            <Table2 aria-hidden="true" />
                                        ) : view.kind === "graph" ? (
                                            <Network aria-hidden="true" />
                                        ) : (
                                            <List aria-hidden="true" />
                                        )}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-medium">{view.title}</span>
                                        <span className="text-base-content/60 mt-1 block truncate text-sm">
                                            {view.description}
                                        </span>
                                    </span>
                                    <ChevronRight aria-hidden="true" className="text-base-content/60" />
                                </Link>
                            ))}
                        </div>
                    </nav>
                ) : (
                    <p className="text-base-content/60 mt-4 text-sm">No configured views are available.</p>
                )}
                <Link className="link mt-4 inline-flex items-center gap-2 text-sm" to="/views">
                    View all configured views
                    <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
            </section>

            <div className={healthFindings.length > 0 ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]" : undefined}>
                <section>
                    <h2 className="text-lg font-semibold">Recently updated</h2>
                    <p className="text-base-content/60 mt-1 text-sm/6">Latest changes across workspace content.</p>
                    {recentEntries.length > 0 ? (
                        <nav aria-label="Recently updated content" className="mt-4">
                            <div className="divide-base-300 divide-y">
                                {recentEntries.map((entry) => (
                                    <Link
                                        className="hover:bg-base-200/50 focus-visible:ring-base-content/30 grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2"
                                        key={entry.path}
                                        to={entry.routePath}
                                    >
                                        <FileText aria-hidden="true" className="text-base-content/60 size-5" />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium">{entry.title}</span>
                                            <code className="text-base-content/60 mt-0.5 block truncate text-xs">
                                                {entry.path}
                                            </code>
                                        </span>
                                        <span
                                            className="text-base-content/60 text-xs whitespace-nowrap"
                                            title={formatAbsoluteDateTime(entry.updatedAt)}
                                        >
                                            {entry.updatedLabel}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </nav>
                    ) : (
                        <p className="text-base-content/60 mt-4 text-sm">No recently updated content was found.</p>
                    )}
                </section>

                {healthFindings.length > 0 ? (
                    <section>
                        <h2 className="text-lg font-semibold">Workspace health</h2>
                        <p className="text-base-content/60 mt-1 text-sm/6">Actionable findings that need attention.</p>
                        <div className="alert alert-outline mt-4 items-start">
                            <AlertTriangle aria-hidden="true" className="mt-0.5" />
                            <div>
                                <h3 className="font-semibold">
                                    {healthFindings.length} {healthFindings.length === 1 ? "finding" : "findings"} need
                                    attention
                                </h3>
                                <p className="text-base-content/60 mt-1 text-sm/6">{healthFindings[0]?.message}</p>
                                <Link className="link mt-3 inline-flex items-center gap-2 text-sm" to="/health">
                                    Open health details
                                    <ArrowRight aria-hidden="true" className="size-4" />
                                </Link>
                            </div>
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
}

function PagesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <PagesOverview dashboard={dashboard} />
            <RouteBodySection
                description="Global page index from the workspace read model."
                meta={`${String(dashboard.entries.length)} indexed`}
                title="All pages"
            >
                <PagesList entries={dashboard.entries} />
            </RouteBodySection>
        </div>
    );
}

function PagesContextPanel({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.entries.filter((entry) => entry.status !== "healthy").length;
    const coveredTaxonomyCount = dashboard.taxonomies.filter((taxonomy) =>
        taxonomy.terms.some((term) => term.entryCount > 0),
    ).length;

    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">Page Index</h2>
                            <p className="text-base-content/60 mt-1 text-sm/6">
                                Route-level read model for the global page list.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Indexed" value={dashboard.entries.length} />
                            <ContextStat label="Taxonomies" value={coveredTaxonomyCount} />
                            <ContextStat label="Warnings" value={warningCount} />
                        </div>
                    </section>
                    <hr className="border-base-300" />
                    <WorkspaceDefaultContextPanel dashboard={dashboard} />
                </>
            }
        />
    );
}

interface EntryOutlineItem {
    blockIndex: number;
    id: string;
    level: 2 | 3;
    text: string;
}

interface EntryOutlineNode extends EntryOutlineItem {
    children: EntryOutlineItem[];
}

function getEntryOutline(blocks: DashboardEntryBlock[]): EntryOutlineItem[] {
    const seen = new Map<string, number>();

    return blocks.flatMap((block, blockIndex) => {
        if (block.type === "html" || block.type === "markdown") {
            return block.outline.map((item) => ({
                ...item,
                blockIndex,
            }));
        }

        if (block.type !== "heading") {
            return [];
        }

        const baseId = slugifyHeading(block.text);
        const count = seen.get(baseId) ?? 0;
        seen.set(baseId, count + 1);

        return [
            {
                blockIndex,
                id: count === 0 ? baseId : `${baseId}-${String(count + 1)}`,
                level: block.level,
                text: block.text,
            },
        ];
    });
}

function getEntryOutlineTree(outline: EntryOutlineItem[]): EntryOutlineNode[] {
    const tree: EntryOutlineNode[] = [];

    for (const item of outline) {
        if (item.level === 2 || tree.length === 0) {
            tree.push({ ...item, children: [] });
            continue;
        }

        tree[tree.length - 1]?.children.push(item);
    }

    return tree;
}

function slugifyHeading(text: string) {
    const slug = text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug || "section";
}

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

function EntryPage({
    entry,
    entries,
    isLoadingDetail,
    outline,
    outlineDialogId,
    outlineDialogRef,
    onOutlineDialogClose,
}: {
    entry: DashboardEntry;
    entries: DashboardEntry[];
    isLoadingDetail: boolean;
    outline: EntryOutlineItem[];
    outlineDialogId: string;
    outlineDialogRef: RefObject<HTMLDialogElement | null>;
    onOutlineDialogClose: () => void;
}) {
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
                        <h1 className="text-3xl font-semibold tracking-normal">{entry.title}</h1>
                        {entry.summary ? <p className="text-base-content/60 text-sm/6">{entry.summary}</p> : null}
                        <div className="text-base-content/60 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                            <span className="flex min-w-0 basis-full items-center gap-1 sm:basis-auto">
                                <code className="min-w-0 break-all">{entry.path}</code>
                                <button
                                    aria-label={`Copy source path ${entry.path}`}
                                    className="btn btn-ghost btn-square btn-xs shrink-0"
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
                            <div
                                aria-busy="true"
                                aria-label="Loading page content"
                                className="flex flex-col gap-5 py-4"
                                role="status"
                            >
                                <div className="skeleton h-4 w-full" />
                                <div className="skeleton h-4 w-11/12" />
                                <div className="skeleton mt-4 h-7 w-2/5" />
                                <div className="skeleton h-4 w-full" />
                                <div className="skeleton h-4 w-4/5" />
                            </div>
                        ) : (
                            <>
                                <EntryReader
                                    blocks={entry.body}
                                    currentPath={entry.path}
                                    entries={entries}
                                    key={entry.path}
                                    omitLeadingTitle={entry.omitLeadingTitle}
                                    outline={outline}
                                />
                                <section
                                    className="border-base-300 scroll-m-8 border-t pt-8 group-has-data-reader-loading/entry:hidden"
                                    id="document-details"
                                >
                                    <div>
                                        <h2 className="text-lg font-semibold">Document details</h2>
                                        <p className="text-base-content/60 mt-1 text-sm/6">
                                            References and checks associated with this entry.
                                        </p>
                                    </div>
                                    <div className="mt-6 flex flex-col gap-8">
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
                                        <a className="btn btn-ghost btn-sm" href={`${entry.routePath}#entry-top`}>
                                            <ArrowUp aria-hidden="true" className="size-4" />
                                            Back to top
                                        </a>
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </div>

                {isLoadingDetail ? (
                    <div aria-hidden="true" className="hidden flex-col gap-4 py-4 xl:flex">
                        <div className="skeleton h-5 w-20" />
                        <div className="skeleton h-3 w-full" />
                        <div className="skeleton h-3 w-4/5" />
                        <div className="skeleton h-3 w-11/12" />
                    </div>
                ) : hasOutline ? (
                    <aside className="hidden xl:block">
                        <div
                            aria-hidden="true"
                            className="hidden flex-col gap-4 py-4 group-has-data-reader-loading/entry:flex"
                        >
                            <div className="skeleton h-5 w-20" />
                            <div className="skeleton h-3 w-full" />
                            <div className="skeleton h-3 w-4/5" />
                            <div className="skeleton h-3 w-11/12" />
                        </div>
                        <EntryOutlineSection
                            onNavigate={navigateOutline}
                            routePath={entry.routePath}
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
                    <aside className="modal-box bg-base-100 text-base-content flex h-svh max-h-none w-80 max-w-[calc(100vw-3rem)] flex-col rounded-none p-0">
                        <header className="border-base-300 flex shrink-0 items-center justify-between gap-3 border-b p-4">
                            <div>
                                <h2 className="font-semibold">Outline</h2>
                                <p className="text-base-content/60 mt-1 text-sm">Headings from the current entry.</p>
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
                            <OutlineNav onNavigate={navigateOutline} routePath={entry.routePath} tree={outlineTree} />
                        </div>
                        <div className="shrink-0 p-2">
                            <OutlineFooterNav onNavigate={navigateOutline} routePath={entry.routePath} />
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

function EntryReader({
    blocks,
    currentPath,
    entries,
    omitLeadingTitle,
    outline,
}: {
    blocks: DashboardEntryBlock[];
    currentPath: string;
    entries: DashboardEntry[];
    omitLeadingTitle: boolean;
    outline: EntryOutlineItem[];
}) {
    const mermaidScope = useMermaidScope(currentPath);

    return (
        <div className="w-full py-2 md:py-4">
            <article className="flex w-full flex-col gap-5">
                {blocks.map((block, index) => {
                    const headingId = outline.find((item) => item.blockIndex === index)?.id;

                    return (
                        <EntryBlockView
                            block={block}
                            currentPath={currentPath}
                            entries={entries}
                            headingId={headingId}
                            mermaidScope={mermaidScope}
                            omitLeadingTitle={omitLeadingTitle && index === 0}
                            key={`${block.type}-${String(index)}`}
                        />
                    );
                })}
            </article>
        </div>
    );
}

function EntryBlockView({
    block,
    currentPath,
    entries,
    headingId,
    mermaidScope,
    omitLeadingTitle = false,
}: {
    block: DashboardEntryBlock;
    currentPath: string;
    entries: DashboardEntry[];
    headingId?: string;
    mermaidScope: ReturnType<typeof createMermaidRenderScope>;
    omitLeadingTitle?: boolean;
}) {
    if (block.type === "markdown") {
        return (
            <MarkdownReader
                currentPath={currentPath}
                entries={entries}
                headings={block.outline}
                markdown={block.markdown}
                mermaidScope={mermaidScope}
                omitLeadingTitle={omitLeadingTitle}
            />
        );
    }

    if (block.type === "html") {
        return (
            <div
                data-reader="markdown"
                // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
                dangerouslySetInnerHTML={{ __html: block.html }}
            />
        );
    }

    if (block.type === "heading") {
        const Heading = block.level === 2 ? "h2" : "h3";
        const className =
            block.level === 2
                ? "text-base-content mt-2 scroll-m-20 text-xl font-semibold tracking-normal first:mt-0"
                : "text-base-content mt-2 scroll-m-20 text-base font-semibold tracking-normal first:mt-0";

        return (
            <Heading className={className} id={headingId}>
                {block.text}
            </Heading>
        );
    }

    if (block.type === "paragraph") {
        return <p className="text-base-content/90 text-sm/7">{block.text}</p>;
    }

    if (block.type === "list") {
        return (
            <ul className="text-base-content/90 flex list-disc flex-col gap-2 ps-5 text-sm/7">
                {block.items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        );
    }

    if (block.type === "quote") {
        return (
            <blockquote className="border-base-300 text-base-content/60 bg-base-200/30 rounded-r-lg border-s-4 px-4 py-3 text-sm/7">
                {block.text}
            </blockquote>
        );
    }

    if (block.type === "code") {
        return (
            <figure className="border-base-300 bg-base-200/50 overflow-hidden rounded-lg border">
                <figcaption className="border-base-300 text-base-content/60 border-b px-4 py-2 text-xs">
                    {block.language}
                </figcaption>
                <pre className="overflow-x-auto p-4 text-sm/6">
                    <code>{block.code}</code>
                </pre>
            </figure>
        );
    }

    return (
        <div className="border-base-300 overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
                <table className="table-sm table min-w-xl">
                    <thead className="bg-base-200 text-base-content/60">
                        <tr>
                            {block.columns.map((column) => (
                                <th className="font-medium" key={column}>
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row) => (
                            <tr key={row.join("|")}>
                                {row.map((cell, cellIndex) => (
                                    <td className="align-top" key={`${block.columns[cellIndex] ?? "cell"}-${cell}`}>
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ContextPanelTabs({
    context,
    outline,
    outlineDesktopOnly = false,
}: {
    context: ReactNode;
    outline?: ReactNode;
    outlineDesktopOnly?: boolean;
}) {
    const hasOutline = outline !== undefined && outline !== null;
    const tabId = useId();

    if (!hasOutline) {
        return <div className="flex flex-col gap-4 p-4 md:p-6 xl:min-h-0 xl:overflow-auto">{context}</div>;
    }

    return (
        <div className="tabs tabs-border grid grid-cols-2 xl:h-full xl:min-h-0" role="tablist">
            <input aria-label="Context" className="tab" defaultChecked name={tabId} role="tab" type="radio" />
            <div className="tab-content col-span-2 p-4 md:p-6 xl:min-h-0 xl:overflow-auto" role="tabpanel">
                <div className="flex flex-col gap-4">{context}</div>
            </div>
            <input
                aria-label="Outline"
                className={cn("tab", outlineDesktopOnly && "hidden xl:inline-grid")}
                name={tabId}
                role="tab"
                type="radio"
            />
            <div
                className={cn(
                    "tab-content col-span-2 p-4 md:p-6 xl:min-h-0 xl:overflow-auto",
                    outlineDesktopOnly && "hidden xl:block",
                )}
                role="tabpanel"
            >
                <div className="flex flex-col gap-3">{outline}</div>
            </div>
        </div>
    );
}

function EntryOutlineSection({
    onNavigate,
    routePath,
    tree,
}: {
    onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
    tree: EntryOutlineNode[];
}) {
    return (
        <section className="sticky top-8 flex max-h-[calc(100dvh-10rem)] min-h-0 flex-col gap-3 overflow-hidden group-has-data-reader-loading/entry:hidden">
            <div className="shrink-0">
                <h2 className="text-sm font-semibold">Outline</h2>
                <p className="text-base-content/60 mt-1 text-sm/6">Headings from the current entry.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <OutlineNav onNavigate={onNavigate} routePath={routePath} tree={tree} />
            </div>
            <OutlineFooterNav onNavigate={onNavigate} routePath={routePath} />
        </section>
    );
}

function OutlineNav({
    onNavigate,
    routePath,
    tree,
}: {
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
    tree: EntryOutlineNode[];
}) {
    return (
        <nav aria-label="Page outline">
            <ul className="menu w-full p-0">
                {tree.map((node) => (
                    <EntryOutlineTreeNode key={node.id} node={node} onNavigate={onNavigate} routePath={routePath} />
                ))}
            </ul>
        </nav>
    );
}

function OutlineFooterNav({
    onNavigate,
    routePath,
}: {
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <nav aria-label="Page outline footer" className="border-base-300 shrink-0 border-t pt-2">
            <ul className="menu w-full p-0">
                <OutlineFooterItems onNavigate={onNavigate} routePath={routePath} />
            </ul>
        </nav>
    );
}

function OutlineFooterItems({
    onNavigate,
    routePath,
}: {
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <>
            <li>
                <a href={`${routePath}#document-details`} onClick={onNavigate}>
                    <span data-link-kind="anchor">Document details</span>
                </a>
            </li>
            <li>
                <a href={`${routePath}#entry-top`} onClick={onNavigate}>
                    <span>Back to top</span>
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                </a>
            </li>
        </>
    );
}

function EntryOutlineTreeNode({
    node,
    onNavigate,
    routePath,
}: {
    node: EntryOutlineNode;
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <li>
            <EntryOutlineLink item={node} onNavigate={onNavigate} routePath={routePath} />
            {node.children.length > 0 && (
                <ul className="before:inset-y-[0.375em]">
                    {node.children.map((child) => (
                        <li key={child.id}>
                            <EntryOutlineLink item={child} onNavigate={onNavigate} routePath={routePath} />
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function EntryOutlineLink({
    item,
    onNavigate,
    routePath,
}: {
    item: EntryOutlineItem;
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <a
            className="min-w-0"
            data-outline-link
            href={`${routePath}#${item.id}`}
            onClick={onNavigate}
            title={item.text}
        >
            <span className="min-w-0 truncate">{item.text}</span>
        </a>
    );
}

function EntryReferencesSection({ entry }: { entry: DashboardEntry }) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold">References</h2>
                <p className="text-base-content/60 mt-1 text-sm/6">
                    Explicit links from Markdown and wikilink indexing.
                </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <OutgoingReferenceGroup links={entry.relations.outgoing} />
                <ReferenceGroup
                    emptyLabel="No backlinks indexed."
                    label="Backlinks"
                    links={entry.relations.backlinks}
                />
            </div>
        </section>
    );
}

function OutgoingReferenceGroup({ links }: { links: DashboardEntryLink[] }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Outgoing</span>
                <span className="badge badge-outline">{links.length}</span>
            </div>
            {links.length > 0 ? (
                <ReferenceList links={links} />
            ) : (
                <p className="text-base-content/60 text-sm">No outgoing links indexed.</p>
            )}
        </div>
    );
}

function ReferenceGroup({
    emptyLabel,
    label,
    links,
}: {
    emptyLabel: string;
    label: string;
    links: DashboardEntryLink[];
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{label}</span>
                <span className="badge badge-outline">{links.length}</span>
            </div>
            {links.length > 0 ? (
                <ReferenceList links={links} />
            ) : (
                <p className="text-base-content/60 text-sm">{emptyLabel}</p>
            )}
        </div>
    );
}

function ReferenceList({ links }: { links: DashboardEntryLink[] }) {
    if (links.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1">
            {links.map((link) => (
                <RelationLink
                    key={`reference-${link.targetPath}`}
                    kind={link.kind}
                    label={link.label}
                    targetEntryId={link.targetEntryId}
                    targetRoutePath={link.targetRoutePath}
                    targetPath={link.targetPath}
                />
            ))}
        </div>
    );
}

function RelationLink({
    kind,
    label,
    targetEntryId,
    targetRoutePath,
    targetPath,
}: {
    kind: DashboardEntryLink["kind"];
    label: string;
    targetEntryId?: string;
    targetRoutePath?: string;
    targetPath: string;
}) {
    const content = (
        <>
            <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate" data-link-kind={kind === "external" ? "external" : undefined}>
                    {label}
                </span>
                <ReferenceKindIndicator kind={kind} />
            </span>
            <span className="text-base-content/60 truncate text-xs" title={targetPath}>
                {targetPath}
            </span>
        </>
    );

    if (kind === "external") {
        return (
            <a
                className="border-base-300/80 bg-base-100/60 hover:bg-base-200/50 focus-visible:border-primary focus-visible:ring-primary/50 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3"
                href={targetPath}
                aria-label={`${label} (opens in a new tab)`}
                rel="noreferrer"
                target="_blank"
            >
                {content}
            </a>
        );
    }

    if (!targetEntryId || !targetRoutePath) {
        return (
            <div className="border-base-300/80 bg-base-100/60 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm">
                {content}
            </div>
        );
    }

    return (
        <Link
            className="border-base-300/80 bg-base-100/60 hover:bg-base-200 focus-visible:border-primary focus-visible:ring-primary/50 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
            to={targetRoutePath}
        >
            {content}
        </Link>
    );
}

function ReferenceKindIndicator({ kind }: { kind: DashboardEntryLink["kind"] }) {
    if (kind !== "unresolved") {
        return null;
    }

    return <span className="badge badge-warning shrink-0">{kind}</span>;
}

function TaxonomiesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <RouteBodySection
            description="Choose a configured taxonomy to browse its terms and matching content."
            meta={`${String(dashboard.taxonomies.length)} taxonomies`}
            title="Configured taxonomies"
        >
            {dashboard.taxonomies.length > 0 ? (
                <TaxonomiesGrid taxonomies={dashboard.taxonomies} />
            ) : (
                <p className="text-base-content/60 py-8 text-sm">No taxonomies are configured.</p>
            )}
        </RouteBodySection>
    );
}

function TaxonomyPage({ taxonomy }: { taxonomy: DashboardTaxonomy }) {
    return (
        <RouteBodySection
            description="Terms declared for this configured taxonomy."
            meta={`${String(taxonomy.terms.length)} terms`}
            title="Configured terms"
        >
            {taxonomy.terms.length > 0 ? (
                <TaxonomyTermsGrid taxonomy={taxonomy} />
            ) : (
                <EmptyState
                    description="Add the first configured term, then verify the workspace configuration."
                    icon={Layers3}
                    title="No terms"
                />
            )}
        </RouteBodySection>
    );
}

function TaxonomyTermPage({ taxonomy, term }: { taxonomy: DashboardTaxonomy; term: DashboardTaxonomyTerm }) {
    return (
        <RouteBodySection
            description={`Content matched by the configured ${taxonomy.title} term.`}
            meta={`${String(term.entries.length)} entries`}
            title="Matching content"
        >
            {term.entries.length > 0 ? (
                <PagesList entries={term.entries} />
            ) : (
                <EmptyState
                    description="No Markdown content currently matches this configured term."
                    icon={FileText}
                    title="No matching content"
                />
            )}
        </RouteBodySection>
    );
}

function ViewsPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <RouteBodySection
            description="Choose a configured projection over the indexed workspace content."
            meta={`${String(dashboard.views.length)} views`}
            title="Configured views"
        >
            {dashboard.views.length > 0 ? (
                <ViewsGrid views={dashboard.views} />
            ) : (
                <p className="text-base-content/60 py-8 text-sm">No views are configured.</p>
            )}
        </RouteBodySection>
    );
}

function ViewPage({
    dashboard,
    onRetry,
    render,
    renderError,
    view,
}: {
    dashboard: WorkspaceDashboard;
    onRetry: () => void;
    render?: DashboardViewRender;
    renderError?: string;
    view: WorkspaceDashboard["views"][number];
}) {
    const mermaidScope = useMermaidScope(render?.document.path ?? view.path);
    const projection = render?.projection;
    const entries = entriesForView(dashboard, view);
    const itemCount = projection ? projectionItemCount(projection) : entries.length;

    return (
        <div className="flex min-w-0 flex-col gap-6">
            <div className="text-base-content/60 flex flex-wrap items-center gap-2 text-xs">
                <span className="badge badge-outline badge-sm">{view.kind}</span>
                <span>{view.space ?? "workspace"}</span>
                <span>{itemCount} items</span>
                <span className="flex min-w-0 basis-full items-center gap-1">
                    <code className="min-w-0 break-all">{view.path}</code>
                    <button
                        aria-label={`Copy source path ${view.path}`}
                        className="btn btn-ghost btn-xs shrink-0"
                        onClick={(event) => {
                            void copySourcePath(event.currentTarget, view.path);
                        }}
                        type="button"
                    >
                        <Copy aria-hidden="true" className="size-3.5" />
                        <span data-source-action-label>Copy path</span>
                    </button>
                </span>
            </div>
            {render?.document.beforeProjection.trim() ? (
                <div className="[&_[data-reader=markdown]>h1:first-child]:hidden">
                    <MarkdownReader
                        currentPath={render.document.path}
                        entries={dashboard.entries}
                        headings={[]}
                        markdown={render.document.beforeProjection}
                        mermaidScope={mermaidScope}
                    />
                </div>
            ) : null}
            <ViewProjectionRenderer error={renderError} onRetry={onRetry} projection={projection} />
            {render?.document.afterProjection.trim() ? (
                <MarkdownReader
                    currentPath={render.document.path}
                    entries={dashboard.entries}
                    headings={[]}
                    markdown={render.document.afterProjection}
                    mermaidScope={mermaidScope}
                />
            ) : null}
        </div>
    );
}

function EmptyPage() {
    return <EmptyState description="No page has been designed for this route yet." icon={FileText} title="Not found" />;
}

function EmptyState({ description, icon: Icon, title }: { description: string; icon: typeof FileText; title: string }) {
    return (
        <section className="card border-base-300 bg-base-100 border">
            <div className="card-body">
                <div className="bg-base-200 text-base-content/60 flex size-10 items-center justify-center rounded-md">
                    <Icon data-icon="inline-start" />
                </div>
                <h2 className="card-title">{title}</h2>
                <p className="text-base-content/60 text-sm">{description}</p>
            </div>
        </section>
    );
}

function RouteBodySection({
    children,
    description,
    meta,
    title,
}: {
    children: ReactNode;
    description: string;
    meta?: string;
    title: string;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
                    <p className="text-base-content/60 mt-1 text-sm/6">{description}</p>
                </div>
                {meta && <span className="text-base-content/60 text-sm">{meta}</span>}
            </div>
            {children}
        </section>
    );
}

function TaxonomiesGrid({ taxonomies }: { taxonomies: DashboardTaxonomy[] }) {
    return (
        <nav aria-label="Configured taxonomies" className="border-base-300 divide-base-300 divide-y border-y">
            {taxonomies.map((taxonomy) => (
                <Link
                    className="hover:bg-base-200/50 focus-visible:bg-base-200/50 grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                    key={taxonomy.id}
                    to={taxonomyRoutePath(taxonomy.id)}
                >
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{taxonomy.title}</span>
                            <span className="badge badge-outline badge-sm">{taxonomy.mode}</span>
                        </div>
                        <p className="text-base-content/60 mt-1 truncate text-sm">{taxonomy.description}</p>
                    </div>
                    <div className="text-base-content/60 hidden gap-4 text-sm sm:flex">
                        <span>{taxonomy.terms.length} terms</span>
                        <span>{taxonomy.terms.reduce((total, term) => total + term.entryCount, 0)} entries</span>
                    </div>
                    <ArrowRight aria-hidden="true" className="text-base-content/50 size-5 shrink-0" />
                </Link>
            ))}
        </nav>
    );
}

function PagesOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.entries.filter((entry) => entry.status !== "healthy").length;
    const coveredTaxonomyCount = dashboard.taxonomies.filter((taxonomy) =>
        taxonomy.terms.some((term) => term.entryCount > 0),
    ).length;

    return (
        <section className="card border-base-300 bg-base-100 border">
            <div className="card-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className={warningCount > 0 ? "badge badge-warning" : "badge"}>{dashboard.status}</span>
                        <h2 className="card-title mt-4">Pages overview</h2>
                        <p className="text-base-content/60 mt-2 text-sm">
                            Global read-only index for Markdown pages in the workspace.
                        </p>
                    </div>
                    <div className="bg-base-200 text-base-content/60 flex size-10 shrink-0 items-center justify-center rounded-md">
                        <FileText data-icon="inline-start" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:gap-3 sm:px-6 sm:pb-6">
                <StatCell label="Indexed" value={dashboard.entries.length} />
                <StatCell label="Taxonomies" value={coveredTaxonomyCount} />
                <StatCell label="Warnings" value={warningCount} />
            </div>
        </section>
    );
}

function PagesList({ entries }: { entries: DashboardEntry[] }) {
    return (
        <nav aria-label="Matching content" className="border-base-300 divide-base-300 divide-y border-y">
            {entries.map((entry) => (
                <EntryRow entry={entry} key={entry.path} />
            ))}
        </nav>
    );
}

function ViewsGrid({ views }: { views: WorkspaceDashboard["views"] }) {
    return (
        <nav aria-label="Configured views" className="border-base-300 divide-base-300 divide-y border-y">
            {views.map((view) => (
                <Link
                    className="hover:bg-base-200/50 focus-visible:bg-base-200/50 grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                    key={view.id}
                    to={viewRoutePath(view.id)}
                >
                    <div className="min-w-0">
                        <div className="truncate font-medium" title={view.title}>
                            {view.title}
                        </div>
                        <div className="text-base-content/60 mt-1 line-clamp-1 text-sm" title={view.description}>
                            {view.description}
                        </div>
                    </div>
                    <span className="badge badge-outline badge-sm hidden justify-self-start sm:inline-flex">
                        {view.kind}
                    </span>
                    <span className="text-base-content/60 hidden truncate text-sm sm:block">
                        {view.space ?? "workspace"}
                    </span>
                    <ChevronRight aria-hidden="true" className="text-base-content/50 size-5 justify-self-end" />
                </Link>
            ))}
        </nav>
    );
}

function ViewProjectionRenderer({
    error,
    onRetry,
    projection,
}: {
    error?: string;
    onRetry: () => void;
    projection?: DashboardViewProjection;
}) {
    if (error) {
        return <ProjectionErrorState message={error} onRetry={onRetry} />;
    }

    if (!projection) {
        return <ProjectionLoadingState />;
    }

    if (projection.kind === "graph") {
        return (
            <Suspense fallback={<ProjectionLoadingState />}>
                <ViewGraphProjection projection={projection} />
            </Suspense>
        );
    }

    if (projection.kind === "list") {
        return <ViewListProjection projection={projection} />;
    }

    if (projection.kind === "kanban") {
        return <ViewKanbanProjection projection={projection} />;
    }

    return <ViewTableProjection projection={projection} />;
}

function entriesForView(dashboard: WorkspaceDashboard, view: WorkspaceDashboard["views"][number]) {
    return view.space ? dashboard.entries.filter((entry) => entry.space === view.space) : dashboard.entries;
}

function projectionItemCount(projection: DashboardViewProjection) {
    if (projection.kind === "kanban") {
        return projection.columns.reduce((total, column) => total + column.items.length, 0);
    }

    if (projection.kind === "graph") {
        return projection.nodes.length;
    }

    return projection.items.length;
}

function ProjectionLoadingState() {
    return (
        <div className="border-base-300 text-base-content/60 rounded-lg border border-dashed p-6 text-sm">
            Loading view projection...
        </div>
    );
}

function ProjectionErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="alert alert-error alert-soft alert-vertical sm:alert-horizontal" role="alert">
            <AlertTriangle aria-hidden="true" className="size-5" />
            <div>
                <h2 className="font-semibold">View projection failed to load</h2>
                <p className="text-sm">{message}</p>
            </div>
            <button className="btn btn-sm" onClick={onRetry} type="button">
                <RefreshCw aria-hidden="true" className="size-4" />
                Retry
            </button>
        </div>
    );
}

async function copySourcePath(button: HTMLButtonElement, path: string) {
    const copyIcon = button.querySelector<SVGElement>("[data-copy-icon]");
    const copiedIcon = button.querySelector<SVGElement>("[data-copied-icon]");
    const originalLabel = button.getAttribute("aria-label") ?? "Copy source path";

    try {
        await navigator.clipboard.writeText(path);
        button.setAttribute("aria-label", `Copied source path ${path}`);
        copyIcon?.classList.add("hidden");
        copiedIcon?.classList.remove("hidden");
    } catch {
        button.setAttribute("aria-label", `Failed to copy source path ${path}`);
    }

    window.setTimeout(() => {
        if (!button.isConnected) return;
        button.setAttribute("aria-label", originalLabel);
        copyIcon?.classList.remove("hidden");
        copiedIcon?.classList.add("hidden");
    }, 1800);
}

function ViewListProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "list" }> }) {
    return (
        <div className="border-base-300 overflow-hidden border-y">
            <div className="divide-base-300 divide-y">
                {projection.items.map((item) => (
                    <ViewListProjectionRow item={item} key={item.path} />
                ))}
                {projection.items.length === 0 ? (
                    <p className="text-base-content/60 p-4 text-sm">No items match this view.</p>
                ) : null}
            </div>
        </div>
    );
}

function ViewListProjectionRow({ item }: { item: DashboardViewProjectionItem }) {
    const summary = item.fields.summary;
    const content = (
        <>
            <span className="block truncate font-medium" title={item.title}>
                {item.title}
            </span>
            {summary ? (
                <span className="text-base-content/60 mt-1 line-clamp-2 block text-sm" title={summary}>
                    {summary}
                </span>
            ) : null}
            <code className="text-base-content/60 mt-2 block truncate text-xs" title={item.path}>
                {item.path}
            </code>
        </>
    );

    if (!item.routePath) {
        return <div className="p-4">{content}</div>;
    }

    return (
        <Link
            className="hover:bg-base-200/50 focus-visible:ring-primary/50 block p-4 transition-colors outline-none focus-visible:ring-3"
            to={item.routePath}
        >
            {content}
        </Link>
    );
}

function ViewTableProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "table" }> }) {
    return (
        <div className="border-base-300 overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
                <table className="table-sm table min-w-max">
                    <thead className="bg-base-200 text-base-content/60">
                        <tr className="border-base-300 border-b">
                            {projection.columns.map((column) => (
                                <th className="font-medium whitespace-nowrap" key={column.field}>
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {projection.items.map((item) => (
                            <tr
                                className="border-base-300 hover:bg-base-200/50 border-b last:border-b-0"
                                key={item.path}
                            >
                                {projection.columns.map((column) => (
                                    <td className="max-w-80 align-top" key={`${item.path}-${column.field}`}>
                                        <ViewProjectionCell column={column} item={item} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ViewProjectionCell({
    column,
    item,
}: {
    column: Extract<DashboardViewProjection, { kind: "table" }>["columns"][number];
    item: DashboardViewProjectionItem;
}) {
    const value = rawViewFieldValue(item, column.field);

    if (value === undefined || value === null || plainViewFieldValue(value) === "") {
        return <span className="text-base-content/50">—</span>;
    }

    if (Array.isArray(value)) {
        return (
            <ul className="space-y-1">
                {value.map((entry, index) => {
                    const label = plainViewFieldValue(entry);
                    return (
                        <li
                            className="text-base-content/70 max-w-72 truncate"
                            key={`${label}-${String(index)}`}
                            title={label}
                        >
                            {label}
                        </li>
                    );
                })}
            </ul>
        );
    }

    const label = plainViewFieldValue(value);
    return (
        <span className="text-base-content/70 block max-w-80 truncate" title={label}>
            {label}
        </span>
    );
}

function ViewKanbanProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "kanban" }> }) {
    return (
        <div
            aria-label="Kanban board"
            className="focus-visible:ring-primary/40 max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-3 outline-none focus-visible:ring-3"
            role="region"
            tabIndex={0}
        >
            <div className="flex min-w-max flex-nowrap items-start gap-3">
                {projection.columns.map((column) => (
                    <section
                        className="border-base-300 bg-base-200 min-h-60 max-w-[min(20rem,85vw)] min-w-[min(16rem,85vw)] flex-[1_0_min(16rem,85vw)] rounded-lg border p-3"
                        key={column.id}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="min-w-0 truncate font-medium" title={column.label}>
                                {column.icon ? <span aria-hidden="true">{column.icon} </span> : null}
                                {column.label}
                            </h3>
                            <span className="badge badge-ghost badge-sm shrink-0">{column.items.length}</span>
                        </div>
                        <div className="flex flex-col gap-3">
                            {column.items.map((item) => (
                                <ViewKanbanCard card={projection.card} item={item} key={item.path} />
                            ))}
                            {column.items.length === 0 ? (
                                <p className="border-base-300 text-base-content/60 rounded-md border border-dashed p-3 text-sm">
                                    No entries
                                </p>
                            ) : null}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function ViewKanbanCard({
    card,
    item,
}: {
    card: Extract<DashboardViewProjection, { kind: "kanban" }>["card"];
    item: DashboardViewProjectionItem;
}) {
    const title = formattedViewFieldValue(item, card.titleField) || item.title || item.path;
    const subtitles = card.subtitleFields
        .map((field) => ({ field, value: formattedViewFieldValue(item, field) }))
        .filter(({ value }) => value !== "");
    const badges = card.badgeFields
        .map((field) => ({ field, value: formattedViewFieldValue(item, field) }))
        .filter(({ value }) => value !== "");
    const content = (
        <div className="card-body gap-2 p-3">
            <span className="card-title block truncate text-base" title={title}>
                {title}
            </span>
            {subtitles.length > 0 ? (
                <div className="grid gap-1">
                    {subtitles.map(({ field, value }) => (
                        <p className="text-base-content/60 line-clamp-2 text-sm" key={field} title={value}>
                            <span className="sr-only">{viewFieldLabel(field)}: </span>
                            {value}
                        </p>
                    ))}
                </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
                {badges.map(({ field, value }) => (
                    <span
                        className="badge badge-soft badge-sm max-w-full"
                        key={field}
                        title={`${viewFieldLabel(field)}: ${value}`}
                    >
                        <span className="sr-only">{viewFieldLabel(field)}: </span>
                        <span className="truncate">{value}</span>
                    </span>
                ))}
            </div>
        </div>
    );

    if (!item.routePath) {
        return (
            <article className="card card-sm card-border border-base-300 bg-base-100 overflow-hidden">
                {content}
            </article>
        );
    }

    return (
        <Link
            className="card card-sm card-border border-base-300 bg-base-100 hover:bg-base-300 focus-visible:ring-primary/50 overflow-hidden transition-colors outline-none focus-visible:ring-3"
            to={item.routePath}
        >
            {content}
        </Link>
    );
}

function rawViewFieldValue(item: DashboardViewProjectionItem, field: string): unknown {
    if (field === "path" || field === "entry.path") return item.path;
    if (field === "title" || field === "entry.title") return item.title;
    const key = field.replace(/^fields\./u, "");
    return item.rawFields[field] ?? item.rawFields[key];
}

function formattedViewFieldValue(item: DashboardViewProjectionItem, field: string): string {
    if (field === "path" || field === "entry.path") return item.path;
    if (field === "title" || field === "entry.title") return item.title;
    const key = field.replace(/^fields\./u, "");
    return item.fields[field] ?? item.fields[key] ?? "";
}

function plainViewFieldValue(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.map(plainViewFieldValue).filter(Boolean).join(", ");
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
    return JSON.stringify(value);
}

function viewFieldLabel(field: string): string {
    return field.replace(/^fields\./u, "");
}

function TaxonomyTermsGrid({ taxonomy }: { taxonomy: DashboardTaxonomy }) {
    return (
        <nav aria-label={`${taxonomy.title} terms`} className="border-base-300 divide-base-300 divide-y border-y">
            {taxonomy.terms.map((term) => (
                <Link
                    className="hover:bg-base-200/50 focus-visible:bg-base-200/50 grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                    key={term.id}
                    to={taxonomyTermRoutePath(taxonomy.id, term.id)}
                >
                    <div className="min-w-0">
                        <span className="font-medium">{term.title}</span>
                        <p className="text-base-content/60 mt-1 truncate text-sm">{term.description}</p>
                    </div>
                    <span className="text-base-content/60 hidden text-sm tabular-nums sm:block">
                        {term.entryCount} {term.entryCount === 1 ? "entry" : "entries"}
                    </span>
                    <ArrowRight aria-hidden="true" className="text-base-content/50 size-5 shrink-0" />
                </Link>
            ))}
        </nav>
    );
}

function ContextStat({ label, title, value }: { label: string; title?: string; value: number | string }) {
    return (
        <div className="border-base-300/80 bg-base-100/60 rounded-lg border p-3">
            <span className="text-base-content/60 text-xs">{label}</span>
            <strong className="mt-1 block truncate text-sm" title={title}>
                {value}
            </strong>
        </div>
    );
}

function StatCell({ label, title, value }: { label: string; title?: string; value: number | string }) {
    return (
        <div className="border-base-300 bg-base-100 rounded-md border p-2 sm:p-3">
            <span className="text-base-content/60 text-xs">{label}</span>
            <strong className="mt-1 block truncate text-sm sm:text-base" title={title ?? String(value)}>
                {value}
            </strong>
        </div>
    );
}

function EntryRow({ entry }: { entry: DashboardEntry }) {
    return (
        <Link
            className="hover:bg-base-200/50 focus-visible:bg-base-200/50 grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none"
            to={entry.routePath}
        >
            <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium" title={entry.title}>
                    {entry.title}
                </h3>
                <p className="text-base-content/60 truncate text-sm" title={entry.summary}>
                    {entry.summary}
                </p>
                <code className="text-base-content/60 mt-2 block truncate text-xs" title={entry.path}>
                    {entry.path}
                </code>
            </div>
            <span className="text-base-content/60 shrink-0 text-xs" title={formatAbsoluteDateTime(entry.updatedAt)}>
                {entry.updatedLabel}
            </span>
        </Link>
    );
}

function healthBadgeClass(status: WorkspaceHealth) {
    return status === "failed" ? "badge badge-error" : status === "warning" ? "badge badge-warning" : "badge";
}
