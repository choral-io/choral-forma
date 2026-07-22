import {
    ArrowUpRight,
    ChevronRight,
    FileText,
    Layers3,
    Network,
    ShieldCheck,
    SlidersHorizontal,
    Workflow,
} from "lucide-react";
import { lazy, Suspense, useEffect, useId, useState, type ReactNode } from "react";
import { Link, useOutletContext, useParams } from "react-router";

import type {
    DashboardDiagnostic,
    DashboardEntry,
    DashboardEntryBlock,
    DashboardEntryLink,
    DashboardSpace,
    DashboardViewProjection,
    DashboardViewProjectionItem,
    DashboardViewRender,
    WorkspaceDashboard,
    WorkspaceHealth,
} from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { DiagnosticsPanel } from "@/features/diagnostics/DiagnosticsPanel";
import {
    WorkspaceDefaultContextPanel,
    WorkspaceRouteActions,
    WorkspaceRouteFrame,
} from "@/features/workspace/WorkspaceRouteFrame";
import { formatAbsoluteDateTime } from "@/lib/date-time";
import { cn } from "@/lib/utils";

import { formatEntrySupportedLanguages } from "./entry-languages";
import { MarkdownReader } from "./MarkdownReader";

const ViewGraphProjection = lazy(async () => {
    const module = await import("./ViewGraphProjection");
    return { default: module.ViewGraphProjection };
});

export function DashboardRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell dashboard={dashboard} eyebrow="Workspace" title="Dashboard">
            <DashboardPage dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function PagesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            contextPanel={<PagesContextPanel dashboard={dashboard} />}
            dashboard={dashboard}
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
    const [readingWidth, setReadingWidth] = useState<ReadingWidth>("standard");
    const summaryEntry = dashboard.entries.find((item) => item.routePath === routePath);
    const [entryDetail, setEntryDetail] = useState<
        | {
              entry: DashboardEntry;
              routePath: string;
          }
        | undefined
    >(undefined);
    const entry = entryDetail?.routePath === routePath ? entryDetail.entry : summaryEntry;
    const outline = entry ? getEntryOutline(entry.body) : [];

    useEffect(() => {
        if (!summaryEntry) {
            return;
        }

        let cancelled = false;
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

    if (!entry) {
        return (
            <WorkspacePageShell dashboard={dashboard} eyebrow="Pages" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    return (
        <WorkspacePageShell
            actions={
                <>
                    <EntryViewOptions readingWidth={readingWidth} onReadingWidthChange={setReadingWidth} />
                    <WorkspaceRouteActions />
                </>
            }
            contextPanel={<EntryContextPanel entry={entry} outline={outline} outlineDesktopOnly />}
            contentWidth="fluid"
            dashboard={dashboard}
            eyebrow="Pages"
            mobileContextPanel={<EntryContextPanel entry={entry} outline={outline} />}
            title={entry.title}
        >
            <EntryPage entry={entry} entries={dashboard.entries} outline={outline} readingWidth={readingWidth} />
        </WorkspacePageShell>
    );
}

export function SpacesRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell dashboard={dashboard} eyebrow="Workspace" title="Spaces">
            <SpacesPage dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function SpaceRoute() {
    const dashboard = useWorkspaceDashboard();
    const { spaceId } = useParams();
    const space = dashboard.spaces.find((item) => item.id === spaceId);
    const entries = space ? dashboard.entries.filter((entry) => entry.space === space.id) : [];

    if (!space) {
        return (
            <WorkspacePageShell dashboard={dashboard} eyebrow="Spaces" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    return (
        <WorkspacePageShell
            contextPanel={<SpaceContextPanel dashboard={dashboard} entries={entries} space={space} />}
            dashboard={dashboard}
            eyebrow="Spaces"
            title={space.title}
        >
            <SpacePage entries={entries} space={space} />
        </WorkspacePageShell>
    );
}

export function ViewsRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            contextPanel={<ViewsContextPanel dashboard={dashboard} />}
            dashboard={dashboard}
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
    const [renderState, setRenderState] = useState<
        | {
              render: DashboardViewRender;
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
                    setRenderState({ render, viewId });
                }
            })
            .catch((error: unknown) => {
                console.warn("View projection failed to load.", error);
            });

        return () => {
            cancelled = true;
        };
    }, [viewId]);

    if (!view) {
        return (
            <WorkspacePageShell dashboard={dashboard} eyebrow="Views" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    const render = renderState && renderState.viewId === viewId ? renderState.render : undefined;
    const projection = render?.projection;

    return (
        <WorkspacePageShell
            contextPanel={<ViewContextPanel dashboard={dashboard} projection={projection} view={view} />}
            dashboard={dashboard}
            eyebrow="Views"
            title={view.title}
        >
            <ViewPage dashboard={dashboard} render={render} view={view} />
        </WorkspacePageShell>
    );
}

export function FallbackRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell dashboard={dashboard} eyebrow="Workspace" title="Not found">
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
    dashboard,
    eyebrow,
    mobileContextPanel,
    title,
}: {
    actions?: ReactNode;
    children: ReactNode;
    contextPanel?: ReactNode;
    contentWidth?: "default" | "fluid" | "readable";
    dashboard: WorkspaceDashboard;
    eyebrow: string;
    mobileContextPanel?: ReactNode;
    title: string;
}) {
    return (
        <WorkspaceRouteFrame
            actions={actions}
            contextPanel={
                contextPanel ?? <ContextPanelTabs context={<WorkspaceDefaultContextPanel dashboard={dashboard} />} />
            }
            contentWidth={contentWidth}
            dashboard={dashboard}
            eyebrow={eyebrow}
            mobileContextPanel={mobileContextPanel}
            title={title}
        >
            {children}
        </WorkspaceRouteFrame>
    );
}

function DashboardPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <WorkspaceOverview dashboard={dashboard} />
            <RouteBodySection
                description="Start with one workflow, then browse the content and views it defines."
                title="Workspace entry points"
            >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <NavigationCard
                        description="Browse the content groups defined by this workspace."
                        icon={Layers3}
                        meta={`${String(dashboard.spaces.length)} spaces`}
                        title="Spaces"
                        to="/spaces"
                    />
                    <NavigationCard
                        description="Open the workspace page index."
                        icon={FileText}
                        meta={`${String(dashboard.entries.length)} indexed`}
                        title="Pages"
                        to="/pages"
                    />
                    <NavigationCard
                        description="Inspect saved read-only projections."
                        icon={Workflow}
                        meta={`${String(dashboard.views.length)} views`}
                        title="Views"
                        to="/views"
                    />
                </div>
            </RouteBodySection>
            <RouteBodySection
                description="Most relevant repository pages from the current workspace index."
                meta={`${String(dashboard.entries.length)} pages`}
                title="Pages"
            >
                <PagesList entries={dashboard.entries} />
            </RouteBodySection>
        </div>
    );
}

function PagesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <PagesOverview dashboard={dashboard} />
            <RouteBodySection
                description="Global page index across spaces from the workspace read model."
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
    const coveredSpaceCount = new Set(dashboard.entries.map((entry) => entry.space)).size;

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
                            <ContextStat label="Spaces" value={coveredSpaceCount} />
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

type ReadingWidth = "full" | "standard" | "wide";

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

const readingWidthOptions: {
    label: string;
    value: ReadingWidth;
}[] = [
    { label: "Standard", value: "standard" },
    { label: "Wide", value: "wide" },
    { label: "Full", value: "full" },
];

function EntryViewOptions({
    onReadingWidthChange,
    readingWidth,
}: {
    onReadingWidthChange: (value: ReadingWidth) => void;
    readingWidth: ReadingWidth;
}) {
    return (
        <label className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="text-base-content/60 size-4" />
            <span className="sr-only">Reading width</span>
            <select
                aria-label="Reading width"
                className="select select-sm"
                onChange={(event) => {
                    onReadingWidthChange(event.target.value as ReadingWidth);
                }}
                value={readingWidth}
            >
                {readingWidthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function EntryPage({
    entry,
    entries,
    outline,
    readingWidth,
}: {
    entry: DashboardEntry;
    entries: DashboardEntry[];
    outline: EntryOutlineItem[];
    readingWidth: ReadingWidth;
}) {
    const readingWidthClass = {
        full: "max-w-none",
        standard: "max-w-4xl",
        wide: "max-w-6xl",
    }[readingWidth];

    return (
        <div className={cn("mx-auto flex w-full flex-col gap-6", readingWidthClass)}>
            <section className="card border-base-300 bg-base-100 border">
                <div className="card-body">
                    <div className="min-w-0">
                        <span className={healthBadgeClass(entry.status)}>{entry.status}</span>
                        <h2 className="card-title mt-4" id={entry.id}>
                            {entry.title}
                        </h2>
                        <p className="text-base-content/60 mt-2 text-sm">{entry.summary}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-4">
                    <StatCell label="Space" value={entry.space} />
                    <StatCell
                        label="Languages"
                        title={formatEntrySupportedLanguages(entry)}
                        value={formatEntrySupportedLanguages(entry)}
                    />
                    <StatCell
                        label="Updated"
                        title={formatAbsoluteDateTime(entry.updatedAt)}
                        value={entry.updatedLabel}
                    />
                    <StatCell label="Status" value={entry.status} />
                </div>
            </section>
            <EntryReader blocks={entry.body} currentPath={entry.path} entries={entries} outline={outline} />
        </div>
    );
}

function EntryReader({
    blocks,
    currentPath,
    entries,
    outline,
}: {
    blocks: DashboardEntryBlock[];
    currentPath: string;
    entries: DashboardEntry[];
    outline: EntryOutlineItem[];
}) {
    return (
        <div className="w-full border-y px-4 py-6 md:py-8">
            <article className="flex w-full flex-col gap-5">
                {blocks.map((block, index) => {
                    const headingId = outline.find((item) => item.blockIndex === index)?.id;

                    return (
                        <EntryBlockView
                            block={block}
                            currentPath={currentPath}
                            entries={entries}
                            headingId={headingId}
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
}: {
    block: DashboardEntryBlock;
    currentPath: string;
    entries: DashboardEntry[];
    headingId?: string;
}) {
    if (block.type === "markdown") {
        return (
            <MarkdownReader
                currentPath={currentPath}
                entries={entries}
                headings={block.outline}
                markdown={block.markdown}
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
                <table className="w-full min-w-xl text-left text-sm">
                    <thead className="bg-base-200/60 text-base-content/60">
                        <tr>
                            {block.columns.map((column) => (
                                <th className="px-4 py-2 font-medium" key={column}>
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row) => (
                            <tr className="border-base-300 border-t" key={row.join("|")}>
                                {row.map((cell, cellIndex) => (
                                    <td
                                        className="px-4 py-3 align-top"
                                        key={`${block.columns[cellIndex] ?? "cell"}-${cell}`}
                                    >
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

function EntryContextPanel({
    entry,
    outline,
    outlineDesktopOnly = false,
}: {
    entry: DashboardEntry;
    outline: EntryOutlineItem[];
    outlineDesktopOnly?: boolean;
}) {
    const diagnostics = getEntryDiagnostics(entry);

    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">Overview</h2>
                            <p className="text-base-content/60 mt-1 text-sm/6">
                                Basic read-model details for the selected page.
                            </p>
                        </div>
                        <div className="border-base-300/80 bg-base-100/60 rounded-lg border p-3">
                            <span className="text-base-content/60 text-xs">Path</span>
                            <code
                                className="text-base-content/60 mt-1 line-clamp-2 text-xs break-all"
                                title={entry.path}
                            >
                                {entry.path}
                            </code>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Languages" value={formatEntrySupportedLanguages(entry)} />
                            <ContextStat
                                label="Updated"
                                title={formatAbsoluteDateTime(entry.updatedAt)}
                                value={entry.updatedLabel}
                            />
                        </div>
                    </section>
                    <hr className="border-base-300" />
                    <EntryReferencesSection entry={entry} />
                    <hr className="border-base-300" />
                    <DiagnosticsPanel
                        description="Page-level checks from the current read model."
                        diagnostics={diagnostics}
                        emptyLabel="No page diagnostics found."
                        title="Diagnostics"
                    />
                </>
            }
            outline={<EntryOutlineSection entry={entry} outline={outline} />}
            outlineDesktopOnly={outlineDesktopOnly}
        />
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

function EntryOutlineSection({ entry, outline }: { entry: DashboardEntry; outline: EntryOutlineItem[] }) {
    const tree = getEntryOutlineTree(outline);

    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold">Outline</h2>
                <p className="text-base-content/60 mt-1 text-sm/6">Headings from the current entry.</p>
            </div>
            {tree.length > 0 ? (
                <OutlineNav entry={entry} tree={tree} />
            ) : (
                <p className="text-base-content/60 text-sm">No headings indexed.</p>
            )}
        </section>
    );
}

function OutlineNav({ entry, tree }: { entry: DashboardEntry; tree: EntryOutlineNode[] }) {
    return (
        <nav aria-label="Page outline" className="flex flex-col gap-1">
            <EntryOutlineLink
                className="text-base-content font-semibold"
                href={`#${entry.id}`}
                item={{
                    blockIndex: -1,
                    id: entry.id,
                    level: 2,
                    text: entry.title,
                }}
            />
            <div className="ms-4 flex flex-col gap-1">
                {tree.map((node) => (
                    <EntryOutlineTreeNode key={node.id} node={node} />
                ))}
            </div>
        </nav>
    );
}

function EntryOutlineTreeNode({ node }: { node: EntryOutlineNode }) {
    return (
        <div className="flex flex-col gap-1">
            <EntryOutlineLink item={node} />
            {node.children.length > 0 && (
                <div className="ms-4 flex flex-col gap-1">
                    {node.children.map((child) => (
                        <EntryOutlineLink item={child} key={child.id} />
                    ))}
                </div>
            )}
        </div>
    );
}

function EntryOutlineLink({ className, href, item }: { className?: string; href?: string; item: EntryOutlineItem }) {
    return (
        <a
            className={cn(
                "text-base-content/60 hover:bg-base-200 hover:text-base-content focus-visible:ring-primary flex h-7 min-w-0 items-center overflow-hidden rounded-md px-2 text-sm outline-none focus-visible:ring-2",
                item.level === 3 && "text-xs",
                className,
            )}
            href={href ?? `#${item.id}`}
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
            <OutgoingReferenceGroup links={entry.relations.outgoing} />
            <ReferenceGroup emptyLabel="No backlinks indexed." label="Backlinks" links={entry.relations.backlinks} />
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
                <span className="min-w-0 truncate">{label}</span>
                <ReferenceKindBadge kind={kind} />
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

function ReferenceKindBadge({ kind }: { kind: DashboardEntryLink["kind"] }) {
    if (kind === "internal") {
        return null;
    }

    return (
        <span className={kind === "unresolved" ? "badge badge-warning shrink-0" : "badge badge-outline shrink-0"}>
            {kind}
        </span>
    );
}

function SpacesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <SpacesOverview dashboard={dashboard} />
            <RouteBodySection
                description="Start with one workflow, then browse the content groups it defines."
                meta={`${String(dashboard.spaces.length)} spaces`}
                title="Browse spaces"
            >
                <SpacesGrid dashboard={dashboard} />
            </RouteBodySection>
        </div>
    );
}

function SpacePage({ entries, space }: { entries: DashboardEntry[]; space: DashboardSpace }) {
    return (
        <div className="flex flex-col gap-6">
            <SpaceSummary space={space} />
            <RouteBodySection
                description="Markdown-backed pages in this configured content group."
                meta={`${String(entries.length)} pages`}
                title="Pages"
            >
                {entries.length > 0 ? (
                    <PagesList entries={entries} />
                ) : (
                    <EmptyState
                        description="Add the first Markdown page for this workflow, then verify it with forma check."
                        icon={FileText}
                        title="No pages"
                    />
                )}
            </RouteBodySection>
        </div>
    );
}

function SpaceContextPanel({
    dashboard,
    entries,
    space,
}: {
    dashboard: WorkspaceDashboard;
    entries: DashboardEntry[];
    space: DashboardSpace;
}) {
    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">Space Context</h2>
                            <p className="text-base-content/60 mt-1 text-sm/6">
                                Route-level read model for the selected configured content group.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Pages" value={space.entryCount} />
                            <ContextStat label="Indexed" value={entries.length} />
                            <ContextStat
                                label="Updated"
                                title={formatAbsoluteDateTime(space.updatedAt)}
                                value={space.updatedLabel}
                            />
                            <ContextStat label="Findings" value={space.status === "healthy" ? 0 : 1} />
                        </div>
                        <div className="border-base-300/80 bg-base-100/60 rounded-lg border p-3">
                            <span className="text-base-content/60 text-xs">Path</span>
                            <code className="text-base-content/60 mt-1 block truncate text-xs">{space.path}</code>
                        </div>
                    </section>
                    <hr className="border-base-300" />
                    <WorkspaceDefaultContextPanel dashboard={dashboard} />
                </>
            }
        />
    );
}

function ViewsPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <ViewsOverview dashboard={dashboard} />
            <RouteBodySection
                description="Saved read-only projections over indexed workspace content."
                meta={`${String(dashboard.views.length)} views`}
                title="Browse views"
            >
                <ViewsGrid views={dashboard.views} />
            </RouteBodySection>
        </div>
    );
}

function ViewsContextPanel({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">Views Index</h2>
                            <p className="text-base-content/60 mt-1 text-sm/6">
                                Route-level read model for saved workspace projections.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Views" value={dashboard.views.length} />
                            <ContextStat label="Pages" value={dashboard.entries.length} />
                            <ContextStat label="Spaces" value={dashboard.spaces.length} />
                        </div>
                    </section>
                    <hr className="border-base-300" />
                    <WorkspaceDefaultContextPanel dashboard={dashboard} />
                </>
            }
        />
    );
}

function ViewPage({
    dashboard,
    render,
    view,
}: {
    dashboard: WorkspaceDashboard;
    render?: DashboardViewRender;
    view: WorkspaceDashboard["views"][number];
}) {
    const projection = render?.projection;
    const entries = entriesForView(dashboard, view);
    const itemCount = projection ? projectionItemCount(projection) : entries.length;

    return (
        <div className="flex flex-col gap-6">
            <ViewSummary dashboard={dashboard} itemCount={itemCount} view={view} />
            {render?.document.beforeProjection.trim() ? (
                <MarkdownReader
                    currentPath={render.document.path}
                    entries={dashboard.entries}
                    headings={[]}
                    markdown={render.document.beforeProjection}
                />
            ) : null}
            <RouteBodySection description={view.description} meta={view.kind} title="Projection preview">
                <ViewProjectionRenderer projection={projection} />
            </RouteBodySection>
            {render?.document.afterProjection.trim() ? (
                <MarkdownReader
                    currentPath={render.document.path}
                    entries={dashboard.entries}
                    headings={[]}
                    markdown={render.document.afterProjection}
                />
            ) : null}
        </div>
    );
}

function ViewContextPanel({
    dashboard,
    projection,
    view,
}: {
    dashboard: WorkspaceDashboard;
    projection?: DashboardViewProjection;
    view: WorkspaceDashboard["views"][number];
}) {
    const itemCount = projection ? projectionItemCount(projection) : entriesForView(dashboard, view).length;

    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">View Context</h2>
                            <p className="text-base-content/60 mt-1 text-sm/6">
                                Route-level read model for the selected saved projection.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Kind" value={view.kind} />
                            <ContextStat label="Items" value={itemCount} />
                        </div>
                    </section>
                    <hr className="border-base-300" />
                    <WorkspaceDefaultContextPanel dashboard={dashboard} />
                </>
            }
        />
    );
}

function EmptyPage() {
    return (
        <SectionIntro description="No page has been designed for this route yet." icon={FileText} title="Not found" />
    );
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

function SectionIntro({
    description,
    icon: Icon,
    title,
}: {
    description: string;
    icon: typeof FileText;
    title: string;
}) {
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

function NavigationCard({
    description,
    icon: Icon,
    meta,
    title,
    to,
}: {
    description: string;
    icon: typeof FileText;
    meta: string;
    title: string;
    to: string;
}) {
    return (
        <Link className="group block rounded-lg outline-none" to={to}>
            <section className="card border-base-300 bg-base-100 group-hover:bg-base-200/50 group-focus-visible:border-primary group-focus-visible:ring-primary/50 h-full border transition-colors group-focus-visible:ring-3">
                <div className="card-body">
                    <div className="bg-base-200 text-base-content/60 flex size-10 items-center justify-center rounded-md">
                        <Icon data-icon="inline-start" />
                    </div>
                    <h2 className="card-title">{title}</h2>
                    <p className="text-base-content/60 text-sm">{description}</p>
                </div>
                <div className="px-6 pb-6">
                    <span className="badge badge-outline">{meta}</span>
                </div>
            </section>
        </Link>
    );
}

function SpacesGrid({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {dashboard.spaces.map((space) => (
                <SpaceCard
                    key={space.id}
                    entryCount={dashboard.entries.filter((entry) => entry.space === space.id).length}
                    space={space}
                />
            ))}
        </div>
    );
}

function SpacesOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const totalEntries = dashboard.spaces.reduce((total, space) => total + space.entryCount, 0);
    const warningCount = dashboard.spaces.filter((space) => space.status !== "healthy").length;

    return (
        <section className="card border-base-300 bg-base-100 border">
            <div className="card-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className={warningCount > 0 ? "badge badge-warning" : "badge"}>{dashboard.status}</span>
                        <h2 className="card-title mt-4">Spaces overview</h2>
                        <p className="text-base-content/60 mt-2 text-sm">
                            Content groups defined by the workspace for browsing.
                        </p>
                    </div>
                    <div className="bg-base-200 text-base-content/60 flex size-10 shrink-0 items-center justify-center rounded-md">
                        <Layers3 data-icon="inline-start" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
                <StatCell label="Spaces" value={dashboard.spaces.length} />
                <StatCell label="Pages" value={totalEntries} />
                <StatCell label="Warnings" value={warningCount} />
            </div>
        </section>
    );
}

function PagesOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.entries.filter((entry) => entry.status !== "healthy").length;
    const coveredSpaceCount = new Set(dashboard.entries.map((entry) => entry.space)).size;

    return (
        <section className="card border-base-300 bg-base-100 border">
            <div className="card-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className={warningCount > 0 ? "badge badge-warning" : "badge"}>{dashboard.status}</span>
                        <h2 className="card-title mt-4">Pages overview</h2>
                        <p className="text-base-content/60 mt-2 text-sm">
                            Global read-only index for Markdown pages across configured spaces.
                        </p>
                    </div>
                    <div className="bg-base-200 text-base-content/60 flex size-10 shrink-0 items-center justify-center rounded-md">
                        <FileText data-icon="inline-start" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
                <StatCell label="Indexed" value={dashboard.entries.length} />
                <StatCell label="Spaces" value={coveredSpaceCount} />
                <StatCell label="Warnings" value={warningCount} />
            </div>
        </section>
    );
}

function ViewsOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <section className="card border-base-300 bg-base-100 border">
            <div className="card-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className="badge">preview</span>
                        <h2 className="card-title mt-4">Views overview</h2>
                        <p className="text-base-content/60 mt-2 text-sm">
                            Saved projections for list, table, kanban, and graph-style workspace browsing.
                        </p>
                    </div>
                    <div className="bg-base-200 text-base-content/60 flex size-10 shrink-0 items-center justify-center rounded-md">
                        <Workflow data-icon="inline-start" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
                <StatCell label="Views" value={dashboard.views.length} />
                <StatCell label="Pages" value={dashboard.entries.length} />
                <StatCell label="Spaces" value={dashboard.spaces.length} />
            </div>
        </section>
    );
}

function PagesList({ entries }: { entries: DashboardEntry[] }) {
    return (
        <div className="grid gap-3">
            {entries.map((entry) => (
                <EntryRow entry={entry} key={entry.path} />
            ))}
        </div>
    );
}

function ViewsGrid({ views }: { views: WorkspaceDashboard["views"] }) {
    return (
        <div className="border-base-300 bg-base-100 overflow-hidden rounded-lg border">
            <div className="text-base-content/60 bg-base-200/50 grid grid-cols-[minmax(0,1fr)_5rem_7rem_2.5rem] gap-4 border-b px-4 py-2 text-xs font-medium">
                <span>View</span>
                <span>Kind</span>
                <span>Scope</span>
                <span className="sr-only">Open</span>
            </div>
            <div className="divide-base-300 divide-y">
                {views.map((view) => (
                    <Link
                        className="hover:bg-base-200/50 focus-visible:ring-primary/50 grid grid-cols-[minmax(0,1fr)_5rem_7rem_2.5rem] items-center gap-4 px-4 py-3 transition-colors outline-none focus-visible:ring-3"
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
                        <span className="badge badge-outline justify-self-start">{view.kind}</span>
                        <span className="text-base-content/60 truncate text-sm">{view.space ?? "workspace"}</span>
                        <ChevronRight className="text-base-content/60 justify-self-end" />
                    </Link>
                ))}
            </div>
        </div>
    );
}

function viewRoutePath(viewId: string) {
    return `/views/${viewId
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;
}

function ViewSummary({
    dashboard,
    itemCount,
    view,
}: {
    dashboard: WorkspaceDashboard;
    itemCount: number;
    view: WorkspaceDashboard["views"][number];
}) {
    return (
        <section className="card border-base-300 bg-base-100 border">
            <div className="card-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className="badge badge-outline">{view.kind}</span>
                        <h2 className="card-title mt-4">{view.title}</h2>
                        <p className="text-base-content/60 mt-2 text-sm">{view.description}</p>
                    </div>
                    <div className="bg-base-200 text-base-content/60 flex size-10 shrink-0 items-center justify-center rounded-md">
                        <Workflow data-icon="inline-start" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
                <StatCell label="Items" value={itemCount} />
                <StatCell label="Spaces" value={dashboard.spaces.length} />
                <StatCell label="Space" value={view.space ?? "workspace"} />
            </div>
        </section>
    );
}

function ViewProjectionRenderer({ projection }: { projection?: DashboardViewProjection }) {
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

function ViewListProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "list" }> }) {
    return (
        <div className="border-base-300 overflow-hidden rounded-lg border">
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
                <table className="w-full min-w-160 text-sm">
                    <thead className="bg-base-200/60 text-base-content/60">
                        <tr className="border-base-300 border-b">
                            {projection.columns.map((column) => (
                                <th className="px-4 py-3 text-start font-medium" key={column.field}>
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
                                    <td className="max-w-80 px-4 py-3 align-top" key={`${item.path}-${column.field}`}>
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
    if (column.field === "path") {
        return (
            <code className="text-base-content/60 block truncate text-xs" title={item.path}>
                {item.path}
            </code>
        );
    }

    const value = item.fields[column.field] ?? "";

    return (
        <span className="text-base-content/60 block truncate" title={value}>
            {value || "—"}
        </span>
    );
}

function ViewKanbanProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "kanban" }> }) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {projection.columns.map((column) => (
                <section className="bg-base-200/30 flex min-h-60 flex-col gap-3 rounded-lg border p-3" key={column.id}>
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium">{column.label}</h3>
                        <span className="badge badge-outline">{column.items.length}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {column.items.map((item) => (
                            <ViewKanbanCard item={item} key={item.path} />
                        ))}
                        {column.items.length === 0 ? (
                            <p className="text-base-content/60 rounded-md border border-dashed p-3 text-sm">
                                No items in this group.
                            </p>
                        ) : null}
                    </div>
                </section>
            ))}
        </div>
    );
}

function ViewKanbanCard({ item }: { item: DashboardViewProjectionItem }) {
    const summary = item.fields.summary;
    const badges = Object.entries(item.fields).filter(([key, value]) => key !== "title" && key !== "summary" && value);
    const content = (
        <>
            <span className="block truncate font-medium" title={item.title}>
                {item.title}
            </span>
            {summary ? (
                <span className="text-base-content/60 mt-2 line-clamp-2 block text-sm" title={summary}>
                    {summary}
                </span>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
                {badges.map(([key, value]) => (
                    <span className="badge badge-outline" key={key}>
                        {value}
                    </span>
                ))}
            </div>
        </>
    );

    if (!item.routePath) {
        return <div className="bg-base-100 rounded-md border p-3 shadow-sm">{content}</div>;
    }

    return (
        <Link
            className="bg-base-100 hover:bg-base-200/50 focus-visible:ring-primary/50 rounded-md border p-3 shadow-sm transition-colors outline-none focus-visible:ring-3"
            to={item.routePath}
        >
            {content}
        </Link>
    );
}

function SpaceSummary({ space }: { space: DashboardSpace }) {
    return (
        <section className="card border-base-300 bg-base-100 border">
            <div className="card-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <span className={healthBadgeClass(space.status)}>{space.status}</span>
                        <h2 className="card-title mt-4">{space.title}</h2>
                        <p className="text-base-content/60 mt-2 text-sm">{space.description}</p>
                    </div>
                    <code className="text-base-content/60 bg-base-200 max-w-full truncate rounded-md px-2 py-1 text-xs">
                        {space.path}
                    </code>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-3">
                <StatCell label="Pages" value={space.entryCount} />
                <StatCell label="Updated" title={formatAbsoluteDateTime(space.updatedAt)} value={space.updatedLabel} />
                <StatCell label="Findings" value={space.status === "healthy" ? 0 : 1} />
            </div>
        </section>
    );
}

function WorkspaceOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <section className="border-base-300 bg-base-100 rounded-lg border p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                    <span className={healthBadgeClass(dashboard.status)}>{dashboard.status}</span>
                    <h2 className="mt-4 text-3xl font-semibold tracking-normal">{dashboard.workspaceName}</h2>
                    <p className="text-base-content/60 mt-3 text-sm/6">{dashboard.tagline}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <span className="badge badge-outline">Read-only GUI</span>
                        <span className="badge badge-outline">Repository Markdown</span>
                        <span className="badge badge-outline">Workspace index</span>
                    </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-3 sm:w-72">
                    <Metric icon={FileText} label="Pages" value={dashboard.entries.length} />
                    <Metric icon={ShieldCheck} label="Findings" value={dashboard.health.findings.length} />
                    <Metric icon={Network} label="Views" value={dashboard.views.length} />
                    <Metric icon={ArrowUpRight} label="Spaces" value={dashboard.spaces.length} />
                </div>
            </div>
        </section>
    );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
    return (
        <div className="border-base-300 bg-base-100 rounded-lg border p-3">
            <Icon className="text-base-content/60" data-icon="inline-start" />
            <strong className="mt-3 block text-2xl">{value}</strong>
            <span className="text-base-content/60 text-xs">{label}</span>
        </div>
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
        <div className="border-base-300 bg-base-100 rounded-md border p-3">
            <span className="text-base-content/60 text-xs">{label}</span>
            <strong className="mt-1 block truncate text-base" title={title}>
                {value}
            </strong>
        </div>
    );
}

function SpaceCard({ entryCount, space }: { entryCount: number; space: DashboardSpace }) {
    return (
        <Link className="group block rounded-lg outline-none" to={`/spaces/${space.id}`}>
            <section className="card border-base-300 bg-base-100 group-hover:bg-base-200/50 group-focus-visible:border-primary group-focus-visible:ring-primary/50 flex h-full flex-col border transition-colors group-focus-visible:ring-3">
                <div className="card-body">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="card-title truncate">{space.title}</h2>
                            <p className="text-base-content/60 mt-2 line-clamp-2 text-sm" title={space.description}>
                                {space.description}
                            </p>
                        </div>
                        <ArrowUpRight className="text-base-content/60 shrink-0" />
                    </div>
                </div>
                <div className="mt-auto flex flex-col gap-3 px-6 pb-6">
                    <div className="flex items-center justify-between gap-3">
                        <span className={healthBadgeClass(space.status)}>{space.status}</span>
                        <code className="text-base-content/60 min-w-0 truncate text-xs">{space.path}</code>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <StatCell label="Pages" value={space.entryCount} />
                        <StatCell label="Indexed" value={entryCount} />
                        <StatCell
                            label="Updated"
                            title={formatAbsoluteDateTime(space.updatedAt)}
                            value={space.updatedLabel}
                        />
                    </div>
                </div>
            </section>
        </Link>
    );
}

function EntryRow({ entry }: { entry: DashboardEntry }) {
    return (
        <Link
            className="border-base-300 bg-base-100 group hover:bg-base-200/50 focus-visible:border-primary focus-visible:ring-primary/50 flex min-w-0 flex-col gap-3 rounded-lg border p-4 shadow-sm transition-colors outline-none focus-visible:ring-3 sm:flex-row sm:items-center"
            to={entry.routePath}
        >
            <div className="bg-base-200 text-base-content/60 flex size-10 shrink-0 items-center justify-center rounded-md">
                <FileText data-icon="inline-start" />
            </div>
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
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <span className="badge badge-outline">{entry.space}</span>
                <span className="text-base-content/60 text-xs" title={formatAbsoluteDateTime(entry.updatedAt)}>
                    {entry.updatedLabel}
                </span>
            </div>
        </Link>
    );
}

function healthBadgeClass(status: WorkspaceHealth) {
    return status === "failed" ? "badge badge-error" : status === "warning" ? "badge badge-warning" : "badge";
}
