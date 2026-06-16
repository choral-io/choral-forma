import {
    ArrowUpRight,
    CheckIcon,
    ChevronRight,
    FileText,
    Layers3,
    Network,
    ShieldCheck,
    SlidersHorizontal,
    Workflow,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useOutletContext, useParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
    DashboardDiagnostic,
    DashboardEntry,
    DashboardEntryBlock,
    DashboardEntryLink,
    DashboardSpace,
    DashboardViewProjection,
    DashboardViewProjectionItem,
    WorkspaceDashboard,
    WorkspaceHealth,
} from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { DiagnosticsPanel } from "@/features/diagnostics/DiagnosticsPanel";
import {
    setContextPanelTab,
    useContextPanelTab,
    type ContextPanelTabValue,
} from "@/features/workspace/context-panel-state";
import {
    WorkspaceDefaultContextPanel,
    WorkspaceRouteActions,
    WorkspaceRouteFrame,
} from "@/features/workspace/WorkspaceRouteFrame";
import { formatAbsoluteDateTime } from "@/lib/date-time";
import { cn } from "@/lib/utils";

import { formatEntrySupportedLanguages } from "./entry-languages";
import { MarkdownReader } from "./MarkdownReader";
import { ViewGraphProjection } from "./ViewGraphProjection";

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
    const { viewId } = useParams();
    const view = dashboard.views.find((item) => item.id === viewId);
    const [projectionState, setProjectionState] = useState<
        | {
              projection: DashboardViewProjection;
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
            .getViewProjection(viewId)
            .then((projection) => {
                if (!cancelled) {
                    setProjectionState({ projection, viewId });
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

    const projection = projectionState && projectionState.viewId === viewId ? projectionState.projection : undefined;

    return (
        <WorkspacePageShell
            contextPanel={<ViewContextPanel dashboard={dashboard} projection={projection} view={view} />}
            dashboard={dashboard}
            eyebrow="Views"
            title={view.title}
        >
            <ViewPage dashboard={dashboard} projection={projection} view={view} />
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
                description="Start from the main read-only surfaces of this workspace."
                title="Workspace entry points"
            >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <NavigationCard
                        description="Browse project knowledge by partition."
                        icon={Layers3}
                        meta={`${String(dashboard.spaces.length)} spaces`}
                        title="Spaces"
                        to="/spaces"
                    />
                    <NavigationCard
                        description="Open the global repository page index."
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
                            <p className="text-muted-foreground mt-1 text-sm/6">
                                Route-level read model for the global page list.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Indexed" value={dashboard.entries.length} />
                            <ContextStat label="Spaces" value={coveredSpaceCount} />
                            <ContextStat label="Warnings" value={warningCount} />
                        </div>
                    </section>
                    <Separator />
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
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label="Page view options" size="icon" variant="outline" />}>
                <SlidersHorizontal data-icon="inline-start" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Reading width</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {readingWidthOptions.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onClick={() => {
                                onReadingWidthChange(option.value);
                            }}
                        >
                            <span className="flex-1">{option.label}</span>
                            <CheckIcon
                                aria-hidden
                                className={cn("ms-auto", readingWidth === option.value ? "opacity-100" : "opacity-0")}
                            />
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
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
            <Card>
                <CardHeader>
                    <div className="min-w-0">
                        <Badge variant={healthVariant(entry.status)}>{entry.status}</Badge>
                        <CardTitle className="mt-4" id={entry.id}>
                            {entry.title}
                        </CardTitle>
                        <CardDescription className="mt-2">{entry.summary}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
                </CardContent>
            </Card>
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
                ? "text-foreground mt-2 scroll-m-20 text-xl font-semibold tracking-normal first:mt-0"
                : "text-foreground mt-2 scroll-m-20 text-base font-semibold tracking-normal first:mt-0";

        return (
            <Heading className={className} id={headingId}>
                {block.text}
            </Heading>
        );
    }

    if (block.type === "paragraph") {
        return <p className="text-foreground/90 text-sm/7">{block.text}</p>;
    }

    if (block.type === "list") {
        return (
            <ul className="text-foreground/90 flex list-disc flex-col gap-2 ps-5 text-sm/7">
                {block.items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        );
    }

    if (block.type === "quote") {
        return (
            <blockquote className="border-border text-muted-foreground bg-muted/30 rounded-r-lg border-s-4 px-4 py-3 text-sm/7">
                {block.text}
            </blockquote>
        );
    }

    if (block.type === "code") {
        return (
            <figure className="border-border bg-muted/50 overflow-hidden rounded-lg border">
                <figcaption className="border-border text-muted-foreground border-b px-4 py-2 text-xs">
                    {block.language}
                </figcaption>
                <pre className="overflow-x-auto p-4 text-sm/6">
                    <code>{block.code}</code>
                </pre>
            </figure>
        );
    }

    return (
        <div className="border-border overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
                <table className="w-full min-w-xl text-left text-sm">
                    <thead className="bg-muted/60 text-muted-foreground">
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
                            <tr className="border-border border-t" key={row.join("|")}>
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
                            <p className="text-muted-foreground mt-1 text-sm/6">
                                Basic read-model details for the selected page.
                            </p>
                        </div>
                        <div className="border-border/80 bg-background/60 rounded-lg border p-3">
                            <span className="text-muted-foreground text-xs">Path</span>
                            <code
                                className="text-muted-foreground mt-1 line-clamp-2 text-xs break-all"
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
                    <Separator />
                    <EntryReferencesSection entry={entry} />
                    <Separator />
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
    const activeTab = useContextPanelTab();
    const value = hasOutline ? activeTab : "context";

    return (
        <Tabs
            className="gap-0 xl:h-full xl:min-h-0"
            onValueChange={(nextValue) => {
                setContextPanelTab(nextValue as ContextPanelTabValue);
            }}
            value={value}
        >
            <TabsList
                className={cn(
                    "grid w-full border-b",
                    hasOutline && !outlineDesktopOnly ? "grid-cols-2" : "grid-cols-1 xl:grid-cols-2",
                )}
                variant="line"
            >
                <TabsTrigger value="context">Context</TabsTrigger>
                {hasOutline ? (
                    <TabsTrigger className={cn(outlineDesktopOnly && "hidden xl:inline-flex")} value="outline">
                        Outline
                    </TabsTrigger>
                ) : null}
            </TabsList>
            <TabsContent className="p-4 md:p-6 xl:min-h-0 xl:overflow-auto" value="context">
                <div className="flex flex-col gap-4">{context}</div>
            </TabsContent>
            {hasOutline ? (
                <TabsContent
                    className={cn("p-4 md:p-6 xl:min-h-0 xl:overflow-auto", outlineDesktopOnly && "hidden xl:block")}
                    value="outline"
                >
                    <div className="flex flex-col gap-3">{outline}</div>
                </TabsContent>
            ) : null}
        </Tabs>
    );
}

function EntryOutlineSection({ entry, outline }: { entry: DashboardEntry; outline: EntryOutlineItem[] }) {
    const tree = getEntryOutlineTree(outline);

    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold">Outline</h2>
                <p className="text-muted-foreground mt-1 text-sm/6">Headings from the current entry.</p>
            </div>
            {tree.length > 0 ? (
                <OutlineNav entry={entry} tree={tree} />
            ) : (
                <p className="text-muted-foreground text-sm">No headings indexed.</p>
            )}
        </section>
    );
}

function OutlineNav({ entry, tree }: { entry: DashboardEntry; tree: EntryOutlineNode[] }) {
    return (
        <nav aria-label="Page outline" className="flex flex-col gap-1">
            <EntryOutlineLink
                className="text-foreground font-semibold"
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
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex h-7 min-w-0 items-center overflow-hidden rounded-md px-2 text-sm outline-none focus-visible:ring-2",
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
                <p className="text-muted-foreground mt-1 text-sm/6">
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
                <Badge variant="outline">{links.length}</Badge>
            </div>
            {links.length > 0 ? (
                <ReferenceList links={links} />
            ) : (
                <p className="text-muted-foreground text-sm">No outgoing links indexed.</p>
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
                <Badge variant="outline">{links.length}</Badge>
            </div>
            {links.length > 0 ? (
                <ReferenceList links={links} />
            ) : (
                <p className="text-muted-foreground text-sm">{emptyLabel}</p>
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
            <span className="text-muted-foreground truncate text-xs" title={targetPath}>
                {targetPath}
            </span>
        </>
    );

    if (kind === "external") {
        return (
            <a
                className="border-border/80 bg-background/60 hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3"
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
            <div className="border-border/80 bg-background/60 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm">
                {content}
            </div>
        );
    }

    return (
        <Link
            className="border-border/80 bg-background/60 hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
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
        <Badge className="shrink-0" variant={kind === "unresolved" ? "secondary" : "outline"}>
            {kind}
        </Badge>
    );
}

function SpacesPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <SpacesOverview dashboard={dashboard} />
            <RouteBodySection
                description="Top-level knowledge partitions for browsing decisions, tasks, architecture, and design."
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
                description="Repository-backed pages in this knowledge partition."
                meta={`${String(entries.length)} pages`}
                title="Pages"
            >
                {entries.length > 0 ? (
                    <PagesList entries={entries} />
                ) : (
                    <EmptyState
                        description="The workspace index does not include pages for this space yet."
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
                            <p className="text-muted-foreground mt-1 text-sm/6">
                                Route-level read model for the selected knowledge partition.
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
                        <div className="border-border/80 bg-background/60 rounded-lg border p-3">
                            <span className="text-muted-foreground text-xs">Path</span>
                            <code className="text-muted-foreground mt-1 block truncate text-xs">{space.path}</code>
                        </div>
                    </section>
                    <Separator />
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
                description="Saved read-only projections over indexed workspace knowledge."
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
                            <p className="text-muted-foreground mt-1 text-sm/6">
                                Route-level read model for saved workspace projections.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Views" value={dashboard.views.length} />
                            <ContextStat label="Pages" value={dashboard.entries.length} />
                            <ContextStat label="Spaces" value={dashboard.spaces.length} />
                        </div>
                    </section>
                    <Separator />
                    <WorkspaceDefaultContextPanel dashboard={dashboard} />
                </>
            }
        />
    );
}

function ViewPage({
    dashboard,
    projection,
    view,
}: {
    dashboard: WorkspaceDashboard;
    projection?: DashboardViewProjection;
    view: WorkspaceDashboard["views"][number];
}) {
    const entries = entriesForView(dashboard, view);
    const itemCount = projection ? projectionItemCount(projection) : entries.length;

    return (
        <div className="flex flex-col gap-6">
            <ViewSummary dashboard={dashboard} itemCount={itemCount} view={view} />
            <RouteBodySection description={view.description} meta={view.kind} title="Projection preview">
                <ViewProjectionRenderer projection={projection} />
            </RouteBodySection>
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
                            <p className="text-muted-foreground mt-1 text-sm/6">
                                Route-level read model for the selected saved projection.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Kind" value={view.kind} />
                            <ContextStat label="Items" value={itemCount} />
                        </div>
                    </section>
                    <Separator />
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
        <Card>
            <CardHeader>
                <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
                    <Icon data-icon="inline-start" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
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
        <Card>
            <CardHeader>
                <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
                    <Icon data-icon="inline-start" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
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
                    <p className="text-muted-foreground mt-1 text-sm/6">{description}</p>
                </div>
                {meta && <span className="text-muted-foreground text-sm">{meta}</span>}
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
            <Card className="group-hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-ring/50 h-full transition-colors group-focus-visible:ring-3">
                <CardHeader>
                    <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
                        <Icon data-icon="inline-start" />
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Badge variant="outline">{meta}</Badge>
                </CardContent>
            </Card>
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
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Badge variant={warningCount > 0 ? "secondary" : "default"}>{dashboard.status}</Badge>
                        <CardTitle className="mt-4">Spaces overview</CardTitle>
                        <CardDescription className="mt-2">
                            Repository-backed partitions that organize project knowledge for browsing.
                        </CardDescription>
                    </div>
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                        <Layers3 data-icon="inline-start" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCell label="Spaces" value={dashboard.spaces.length} />
                <StatCell label="Pages" value={totalEntries} />
                <StatCell label="Warnings" value={warningCount} />
            </CardContent>
        </Card>
    );
}

function PagesOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.entries.filter((entry) => entry.status !== "healthy").length;
    const coveredSpaceCount = new Set(dashboard.entries.map((entry) => entry.space)).size;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Badge variant={warningCount > 0 ? "secondary" : "default"}>{dashboard.status}</Badge>
                        <CardTitle className="mt-4">Pages overview</CardTitle>
                        <CardDescription className="mt-2">
                            Global read-only index for repository pages across all knowledge spaces.
                        </CardDescription>
                    </div>
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                        <FileText data-icon="inline-start" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCell label="Indexed" value={dashboard.entries.length} />
                <StatCell label="Spaces" value={coveredSpaceCount} />
                <StatCell label="Warnings" value={warningCount} />
            </CardContent>
        </Card>
    );
}

function ViewsOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Badge variant="secondary">preview</Badge>
                        <CardTitle className="mt-4">Views overview</CardTitle>
                        <CardDescription className="mt-2">
                            Saved projections for list, table, kanban, and graph-style workspace browsing.
                        </CardDescription>
                    </div>
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                        <Workflow data-icon="inline-start" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCell label="Views" value={dashboard.views.length} />
                <StatCell label="Pages" value={dashboard.entries.length} />
                <StatCell label="Spaces" value={dashboard.spaces.length} />
            </CardContent>
        </Card>
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
        <div className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="text-muted-foreground bg-muted/50 grid grid-cols-[minmax(0,1fr)_5rem_7rem_2.5rem] gap-4 border-b px-4 py-2 text-xs font-medium">
                <span>View</span>
                <span>Kind</span>
                <span>Scope</span>
                <span className="sr-only">Open</span>
            </div>
            <div className="divide-border divide-y">
                {views.map((view) => (
                    <Link
                        className="hover:bg-accent/50 focus-visible:ring-ring/50 grid grid-cols-[minmax(0,1fr)_5rem_7rem_2.5rem] items-center gap-4 px-4 py-3 transition-colors outline-none focus-visible:ring-3"
                        key={view.id}
                        to={`/views/${view.id}`}
                    >
                        <div className="min-w-0">
                            <div className="truncate font-medium" title={view.title}>
                                {view.title}
                            </div>
                            <div className="text-muted-foreground mt-1 line-clamp-1 text-sm" title={view.description}>
                                {view.description}
                            </div>
                        </div>
                        <Badge className="justify-self-start" variant="outline">
                            {view.kind}
                        </Badge>
                        <span className="text-muted-foreground truncate text-sm">{view.space ?? "workspace"}</span>
                        <ChevronRight className="text-muted-foreground justify-self-end" />
                    </Link>
                ))}
            </div>
        </div>
    );
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
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Badge variant="outline">{view.kind}</Badge>
                        <CardTitle className="mt-4">{view.title}</CardTitle>
                        <CardDescription className="mt-2">{view.description}</CardDescription>
                    </div>
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                        <Workflow data-icon="inline-start" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCell label="Items" value={itemCount} />
                <StatCell label="Spaces" value={dashboard.spaces.length} />
                <StatCell label="Space" value={view.space ?? "workspace"} />
            </CardContent>
        </Card>
    );
}

function ViewProjectionRenderer({ projection }: { projection?: DashboardViewProjection }) {
    if (!projection) {
        return <ProjectionLoadingState />;
    }

    if (projection.kind === "graph") {
        return <ViewGraphProjection projection={projection} />;
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
        <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
            Loading view projection...
        </div>
    );
}

function ViewListProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "list" }> }) {
    return (
        <div className="border-border overflow-hidden rounded-lg border">
            <div className="divide-border divide-y">
                {projection.items.map((item) => (
                    <ViewListProjectionRow item={item} key={item.path} />
                ))}
                {projection.items.length === 0 ? (
                    <p className="text-muted-foreground p-4 text-sm">No items match this view.</p>
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
                <span className="text-muted-foreground mt-1 line-clamp-2 block text-sm" title={summary}>
                    {summary}
                </span>
            ) : null}
            <code className="text-muted-foreground mt-2 block truncate text-xs" title={item.path}>
                {item.path}
            </code>
        </>
    );

    if (!item.routePath) {
        return <div className="p-4">{content}</div>;
    }

    return (
        <Link
            className="hover:bg-accent/50 focus-visible:ring-ring/50 block p-4 transition-colors outline-none focus-visible:ring-3"
            to={item.routePath}
        >
            {content}
        </Link>
    );
}

function ViewTableProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "table" }> }) {
    return (
        <div className="border-border overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
                <table className="w-full min-w-160 text-sm">
                    <thead className="bg-muted/60 text-muted-foreground">
                        <tr className="border-border border-b">
                            {projection.columns.map((column) => (
                                <th className="px-4 py-3 text-start font-medium" key={column.field}>
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {projection.items.map((item) => (
                            <tr className="border-border hover:bg-accent/50 border-b last:border-b-0" key={item.path}>
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
            <code className="text-muted-foreground block truncate text-xs" title={item.path}>
                {item.path}
            </code>
        );
    }

    const value = item.fields[column.field] ?? "";

    return (
        <span className="text-muted-foreground block truncate" title={value}>
            {value || "—"}
        </span>
    );
}

function ViewKanbanProjection({ projection }: { projection: Extract<DashboardViewProjection, { kind: "kanban" }> }) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {projection.columns.map((column) => (
                <section className="bg-muted/30 flex min-h-60 flex-col gap-3 rounded-lg border p-3" key={column.id}>
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium">{column.label}</h3>
                        <Badge variant="outline">{column.items.length}</Badge>
                    </div>
                    <div className="flex flex-col gap-3">
                        {column.items.map((item) => (
                            <ViewKanbanCard item={item} key={item.path} />
                        ))}
                        {column.items.length === 0 ? (
                            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
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
                <span className="text-muted-foreground mt-2 line-clamp-2 block text-sm" title={summary}>
                    {summary}
                </span>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
                {badges.map(([key, value]) => (
                    <Badge key={key} variant="outline">
                        {value}
                    </Badge>
                ))}
            </div>
        </>
    );

    if (!item.routePath) {
        return <div className="bg-card rounded-md border p-3 shadow-sm">{content}</div>;
    }

    return (
        <Link
            className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 rounded-md border p-3 shadow-sm transition-colors outline-none focus-visible:ring-3"
            to={item.routePath}
        >
            {content}
        </Link>
    );
}

function SpaceSummary({ space }: { space: DashboardSpace }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Badge variant={healthVariant(space.status)}>{space.status}</Badge>
                        <CardTitle className="mt-4">{space.title}</CardTitle>
                        <CardDescription className="mt-2">{space.description}</CardDescription>
                    </div>
                    <code className="text-muted-foreground bg-muted max-w-full truncate rounded-md px-2 py-1 text-xs">
                        {space.path}
                    </code>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCell label="Pages" value={space.entryCount} />
                <StatCell label="Updated" title={formatAbsoluteDateTime(space.updatedAt)} value={space.updatedLabel} />
                <StatCell label="Findings" value={space.status === "healthy" ? 0 : 1} />
            </CardContent>
        </Card>
    );
}

function WorkspaceOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <section className="border-border bg-card rounded-lg border p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                    <Badge variant={healthVariant(dashboard.status)}>{dashboard.status}</Badge>
                    <h2 className="mt-4 text-3xl font-semibold tracking-normal">{dashboard.workspaceName}</h2>
                    <p className="text-muted-foreground mt-3 text-sm/6">{dashboard.tagline}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <Badge variant="outline">Read-only GUI</Badge>
                        <Badge variant="outline">Repository Markdown</Badge>
                        <Badge variant="outline">Workspace index</Badge>
                    </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-3 sm:w-72">
                    <Metric icon={FileText} label="Pages" value={dashboard.entries.length} />
                    <Metric icon={ShieldCheck} label="Findings" value={dashboard.diagnostics.length} />
                    <Metric icon={Network} label="Views" value={dashboard.views.length} />
                    <Metric icon={ArrowUpRight} label="Spaces" value={dashboard.spaces.length} />
                </div>
            </div>
        </section>
    );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
    return (
        <div className="border-border bg-background rounded-lg border p-3">
            <Icon className="text-muted-foreground" data-icon="inline-start" />
            <strong className="mt-3 block text-2xl">{value}</strong>
            <span className="text-muted-foreground text-xs">{label}</span>
        </div>
    );
}

function ContextStat({ label, title, value }: { label: string; title?: string; value: number | string }) {
    return (
        <div className="border-border/80 bg-background/60 rounded-lg border p-3">
            <span className="text-muted-foreground text-xs">{label}</span>
            <strong className="mt-1 block truncate text-sm" title={title}>
                {value}
            </strong>
        </div>
    );
}

function StatCell({ label, title, value }: { label: string; title?: string; value: number | string }) {
    return (
        <div className="border-border bg-background rounded-md border p-3">
            <span className="text-muted-foreground text-xs">{label}</span>
            <strong className="mt-1 block truncate text-base" title={title}>
                {value}
            </strong>
        </div>
    );
}

function SpaceCard({ entryCount, space }: { entryCount: number; space: DashboardSpace }) {
    return (
        <Link className="group block rounded-lg outline-none" to={`/spaces/${space.id}`}>
            <Card className="group-hover:bg-accent/50 group-focus-visible:border-ring group-focus-visible:ring-ring/50 flex h-full flex-col transition-colors group-focus-visible:ring-3">
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <CardTitle className="truncate">{space.title}</CardTitle>
                            <CardDescription className="mt-2 line-clamp-2" title={space.description}>
                                {space.description}
                            </CardDescription>
                        </div>
                        <ArrowUpRight className="text-muted-foreground shrink-0" />
                    </div>
                </CardHeader>
                <CardContent className="mt-auto flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <Badge variant={healthVariant(space.status)}>{space.status}</Badge>
                        <code className="text-muted-foreground min-w-0 truncate text-xs">{space.path}</code>
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
                </CardContent>
            </Card>
        </Link>
    );
}

function EntryRow({ entry }: { entry: DashboardEntry }) {
    return (
        <Link
            className="border-border bg-card group hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-0 flex-col gap-3 rounded-lg border p-4 shadow-sm transition-colors outline-none focus-visible:ring-3 sm:flex-row sm:items-center"
            to={entry.routePath}
        >
            <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                <FileText data-icon="inline-start" />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium" title={entry.title}>
                    {entry.title}
                </h3>
                <p className="text-muted-foreground truncate text-sm" title={entry.summary}>
                    {entry.summary}
                </p>
                <code className="text-muted-foreground mt-2 block truncate text-xs" title={entry.path}>
                    {entry.path}
                </code>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant="outline">{entry.space}</Badge>
                <span className="text-muted-foreground text-xs" title={formatAbsoluteDateTime(entry.updatedAt)}>
                    {entry.updatedLabel}
                </span>
            </div>
        </Link>
    );
}

function healthVariant(status: WorkspaceHealth) {
    return status === "failed" ? "destructive" : status === "warning" ? "secondary" : "default";
}
