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
    DashboardDocument,
    DashboardDocumentBlock,
    DashboardDocumentLink,
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

export function DocumentsRoute() {
    const dashboard = useWorkspaceDashboard();

    return (
        <WorkspacePageShell
            contextPanel={<DocumentsContextPanel dashboard={dashboard} />}
            dashboard={dashboard}
            eyebrow="Workspace"
            title="Documents"
        >
            <DocumentsPage dashboard={dashboard} />
        </WorkspacePageShell>
    );
}

export function DocumentRoute() {
    const dashboard = useWorkspaceDashboard();
    const { documentId } = useParams();
    const [readingWidth, setReadingWidth] = useState<ReadingWidth>("standard");
    const summaryDocument = dashboard.documents.find((item) => item.id === documentId);
    const [documentDetail, setDocumentDetail] = useState<
        | {
              document: DashboardDocument;
              documentId: string;
          }
        | undefined
    >(undefined);
    const document =
        documentDetail && documentDetail.documentId === documentId ? documentDetail.document : summaryDocument;
    const outline = document ? getDocumentOutline(document.body) : [];

    useEffect(() => {
        if (!documentId) {
            return;
        }

        let cancelled = false;
        workspaceClient
            .getDocument(documentId)
            .then((result) => {
                if (!cancelled) {
                    setDocumentDetail({ document: result, documentId });
                }
            })
            .catch((error: unknown) => {
                console.warn("Document detail failed to load.", error);
                if (!cancelled && summaryDocument) {
                    setDocumentDetail({
                        document: {
                            ...summaryDocument,
                            diagnostics: [
                                ...(summaryDocument.diagnostics ?? []),
                                {
                                    severity: "warning",
                                    code: "document-detail-load-failed",
                                    message:
                                        error instanceof Error
                                            ? error.message
                                            : "Document detail failed to load from the workspace backend.",
                                    path: summaryDocument.path,
                                },
                            ],
                        },
                        documentId,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [documentId, summaryDocument]);

    if (!document) {
        return (
            <WorkspacePageShell dashboard={dashboard} eyebrow="Documents" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    return (
        <WorkspacePageShell
            actions={
                <>
                    <DocumentViewOptions readingWidth={readingWidth} onReadingWidthChange={setReadingWidth} />
                    <WorkspaceRouteActions />
                </>
            }
            contextPanel={<DocumentContextPanel document={document} outline={outline} outlineDesktopOnly />}
            contentWidth="fluid"
            dashboard={dashboard}
            eyebrow="Documents"
            mobileContextPanel={<DocumentContextPanel document={document} outline={outline} />}
            title={document.title}
        >
            <DocumentPage
                document={document}
                documents={dashboard.documents}
                outline={outline}
                readingWidth={readingWidth}
            />
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
    const documents = space ? dashboard.documents.filter((document) => document.space === space.id) : [];

    if (!space) {
        return (
            <WorkspacePageShell dashboard={dashboard} eyebrow="Spaces" title="Not found">
                <EmptyPage />
            </WorkspacePageShell>
        );
    }

    return (
        <WorkspacePageShell
            contextPanel={<SpaceContextPanel dashboard={dashboard} documents={documents} space={space} />}
            dashboard={dashboard}
            eyebrow="Spaces"
            title={space.title}
        >
            <SpacePage documents={documents} space={space} />
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
                        description="Open the global repository document index."
                        icon={FileText}
                        meta={`${String(dashboard.documents.length)} indexed`}
                        title="Documents"
                        to="/documents"
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
                description="Most relevant repository documents from the current workspace index."
                meta={`${String(dashboard.documents.length)} documents`}
                title="Documents"
            >
                <DocumentsList documents={dashboard.documents} />
            </RouteBodySection>
        </div>
    );
}

function DocumentsPage({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return (
        <div className="flex flex-col gap-6">
            <DocumentsOverview dashboard={dashboard} />
            <RouteBodySection
                description="Global document index across spaces from the workspace read model."
                meta={`${String(dashboard.documents.length)} indexed`}
                title="All documents"
            >
                <DocumentsList documents={dashboard.documents} />
            </RouteBodySection>
        </div>
    );
}

function DocumentsContextPanel({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.documents.filter((document) => document.status !== "healthy").length;
    const coveredSpaceCount = new Set(dashboard.documents.map((document) => document.space)).size;

    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">Document Index</h2>
                            <p className="text-muted-foreground mt-1 text-sm/6">
                                Route-level read model for the global document list.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat label="Indexed" value={dashboard.documents.length} />
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

interface DocumentOutlineItem {
    blockIndex: number;
    id: string;
    level: 2 | 3;
    text: string;
}

interface DocumentOutlineNode extends DocumentOutlineItem {
    children: DocumentOutlineItem[];
}

function getDocumentOutline(blocks: DashboardDocumentBlock[]): DocumentOutlineItem[] {
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

function getDocumentOutlineTree(outline: DocumentOutlineItem[]): DocumentOutlineNode[] {
    const tree: DocumentOutlineNode[] = [];

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

function getDocumentDiagnostics(document: DashboardDocument): DashboardDiagnostic[] {
    const diagnostics: DashboardDiagnostic[] = [...(document.diagnostics ?? [])];
    const unresolvedLinks = document.relations.outgoing.filter((link) => link.kind === "unresolved");

    if (document.status !== "healthy") {
        diagnostics.push({
            severity: document.status === "failed" ? "error" : "warning",
            code: "document-status",
            message: `This document is marked ${document.status} in the current read model.`,
            path: document.path,
        });
    }

    diagnostics.push(
        ...unresolvedLinks.map((link) => ({
            severity: "warning" as const,
            code: "unresolved-link",
            message: `Outgoing reference "${link.label}" is not resolved by the current document index.`,
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

function DocumentViewOptions({
    onReadingWidthChange,
    readingWidth,
}: {
    onReadingWidthChange: (value: ReadingWidth) => void;
    readingWidth: ReadingWidth;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button aria-label="Document view options" size="icon" variant="outline" />}>
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

function DocumentPage({
    document,
    documents,
    outline,
    readingWidth,
}: {
    document: DashboardDocument;
    documents: DashboardDocument[];
    outline: DocumentOutlineItem[];
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
                        <Badge variant={healthVariant(document.status)}>{document.status}</Badge>
                        <CardTitle className="mt-4" id={document.id}>
                            {document.title}
                        </CardTitle>
                        <CardDescription className="mt-2">{document.summary}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCell label="Space" value={document.space} />
                    <StatCell
                        label="Updated"
                        title={formatAbsoluteDateTime(document.updatedAt)}
                        value={document.updatedLabel}
                    />
                    <StatCell label="Status" value={document.status} />
                </CardContent>
            </Card>
            <DocumentReader
                blocks={document.body}
                currentPath={document.path}
                documents={documents}
                outline={outline}
            />
        </div>
    );
}

function DocumentReader({
    blocks,
    currentPath,
    documents,
    outline,
}: {
    blocks: DashboardDocumentBlock[];
    currentPath: string;
    documents: DashboardDocument[];
    outline: DocumentOutlineItem[];
}) {
    return (
        <div className="w-full border-y px-4 py-6 md:py-8">
            <article className="flex w-full flex-col gap-5">
                {blocks.map((block, index) => {
                    const headingId = outline.find((item) => item.blockIndex === index)?.id;

                    return (
                        <DocumentBlockView
                            block={block}
                            currentPath={currentPath}
                            documents={documents}
                            headingId={headingId}
                            key={`${block.type}-${String(index)}`}
                        />
                    );
                })}
            </article>
        </div>
    );
}

function DocumentBlockView({
    block,
    currentPath,
    documents,
    headingId,
}: {
    block: DashboardDocumentBlock;
    currentPath: string;
    documents: DashboardDocument[];
    headingId?: string;
}) {
    if (block.type === "markdown") {
        return (
            <MarkdownReader
                currentPath={currentPath}
                documents={documents}
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

function DocumentContextPanel({
    document,
    outline,
    outlineDesktopOnly = false,
}: {
    document: DashboardDocument;
    outline: DocumentOutlineItem[];
    outlineDesktopOnly?: boolean;
}) {
    const diagnostics = getDocumentDiagnostics(document);

    return (
        <ContextPanelTabs
            context={
                <>
                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold">Overview</h2>
                            <p className="text-muted-foreground mt-1 text-sm/6">
                                Basic read-model details for the selected document.
                            </p>
                        </div>
                        <div className="border-border/80 bg-background/60 rounded-lg border p-3">
                            <span className="text-muted-foreground text-xs">Path</span>
                            <code
                                className="text-muted-foreground mt-1 line-clamp-2 text-xs break-all"
                                title={document.path}
                            >
                                {document.path}
                            </code>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <ContextStat
                                label="Updated"
                                title={formatAbsoluteDateTime(document.updatedAt)}
                                value={document.updatedLabel}
                            />
                        </div>
                    </section>
                    <Separator />
                    <DocumentReferencesSection document={document} />
                    <Separator />
                    <DiagnosticsPanel
                        description="Document-level checks from the current read model."
                        diagnostics={diagnostics}
                        emptyLabel="No document diagnostics found."
                        title="Diagnostics"
                    />
                </>
            }
            outline={<DocumentOutlineSection document={document} outline={outline} />}
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

function DocumentOutlineSection({
    document,
    outline,
}: {
    document: DashboardDocument;
    outline: DocumentOutlineItem[];
}) {
    const tree = getDocumentOutlineTree(outline);

    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold">Outline</h2>
                <p className="text-muted-foreground mt-1 text-sm/6">Headings from the current document.</p>
            </div>
            {tree.length > 0 ? (
                <OutlineNav document={document} tree={tree} />
            ) : (
                <p className="text-muted-foreground text-sm">No headings indexed.</p>
            )}
        </section>
    );
}

function OutlineNav({ document, tree }: { document: DashboardDocument; tree: DocumentOutlineNode[] }) {
    return (
        <nav aria-label="Document outline" className="flex flex-col gap-1">
            <DocumentOutlineLink
                className="text-foreground font-semibold"
                href={`#${document.id}`}
                item={{
                    blockIndex: -1,
                    id: document.id,
                    level: 2,
                    text: document.title,
                }}
            />
            <div className="ms-4 flex flex-col gap-1">
                {tree.map((node) => (
                    <DocumentOutlineTreeNode key={node.id} node={node} />
                ))}
            </div>
        </nav>
    );
}

function DocumentOutlineTreeNode({ node }: { node: DocumentOutlineNode }) {
    return (
        <div className="flex flex-col gap-1">
            <DocumentOutlineLink item={node} />
            {node.children.length > 0 && (
                <div className="ms-4 flex flex-col gap-1">
                    {node.children.map((child) => (
                        <DocumentOutlineLink item={child} key={child.id} />
                    ))}
                </div>
            )}
        </div>
    );
}

function DocumentOutlineLink({
    className,
    href,
    item,
}: {
    className?: string;
    href?: string;
    item: DocumentOutlineItem;
}) {
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

function DocumentReferencesSection({ document }: { document: DashboardDocument }) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold">References</h2>
                <p className="text-muted-foreground mt-1 text-sm/6">
                    Explicit links from Markdown and wikilink indexing.
                </p>
            </div>
            <OutgoingReferenceGroup links={document.relations.outgoing} />
            <ReferenceGroup emptyLabel="No backlinks indexed." label="Backlinks" links={document.relations.backlinks} />
        </section>
    );
}

function OutgoingReferenceGroup({ links }: { links: DashboardDocumentLink[] }) {
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
    links: DashboardDocumentLink[];
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

function ReferenceList({ links }: { links: DashboardDocumentLink[] }) {
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
                    targetDocumentId={link.targetDocumentId}
                    targetPath={link.targetPath}
                />
            ))}
        </div>
    );
}

function RelationLink({
    kind,
    label,
    targetDocumentId,
    targetPath,
}: {
    kind: DashboardDocumentLink["kind"];
    label: string;
    targetDocumentId?: string;
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

    if (!targetDocumentId) {
        return (
            <div className="border-border/80 bg-background/60 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm">
                {content}
            </div>
        );
    }

    return (
        <Link
            className="border-border/80 bg-background/60 hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-0 flex-col rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
            to={`/documents/${targetDocumentId}`}
        >
            {content}
        </Link>
    );
}

function ReferenceKindBadge({ kind }: { kind: DashboardDocumentLink["kind"] }) {
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

function SpacePage({ documents, space }: { documents: DashboardDocument[]; space: DashboardSpace }) {
    return (
        <div className="flex flex-col gap-6">
            <SpaceSummary space={space} />
            <RouteBodySection
                description="Repository markdown entries in this knowledge partition."
                meta={`${String(documents.length)} documents`}
                title="Documents"
            >
                {documents.length > 0 ? (
                    <DocumentsList documents={documents} />
                ) : (
                    <EmptyState
                        description="The workspace index does not include documents for this space yet."
                        icon={FileText}
                        title="No documents"
                    />
                )}
            </RouteBodySection>
        </div>
    );
}

function SpaceContextPanel({
    dashboard,
    documents,
    space,
}: {
    dashboard: WorkspaceDashboard;
    documents: DashboardDocument[];
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
                            <ContextStat label="Entries" value={space.entryCount} />
                            <ContextStat label="Documents" value={documents.length} />
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
                            <ContextStat label="Documents" value={dashboard.documents.length} />
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
    const documents = documentsForView(dashboard, view);
    const itemCount = projection ? projectionItemCount(projection) : documents.length;

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
    const itemCount = projection ? projectionItemCount(projection) : documentsForView(dashboard, view).length;

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
                    documentCount={dashboard.documents.filter((document) => document.space === space.id).length}
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
                <StatCell label="Entries" value={totalEntries} />
                <StatCell label="Warnings" value={warningCount} />
            </CardContent>
        </Card>
    );
}

function DocumentsOverview({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const warningCount = dashboard.documents.filter((document) => document.status !== "healthy").length;
    const coveredSpaceCount = new Set(dashboard.documents.map((document) => document.space)).size;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <Badge variant={warningCount > 0 ? "secondary" : "default"}>{dashboard.status}</Badge>
                        <CardTitle className="mt-4">Documents overview</CardTitle>
                        <CardDescription className="mt-2">
                            Global read-only index for repository markdown files across all knowledge spaces.
                        </CardDescription>
                    </div>
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                        <FileText data-icon="inline-start" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCell label="Indexed" value={dashboard.documents.length} />
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
                <StatCell label="Documents" value={dashboard.documents.length} />
                <StatCell label="Spaces" value={dashboard.spaces.length} />
            </CardContent>
        </Card>
    );
}

function DocumentsList({ documents }: { documents: DashboardDocument[] }) {
    return (
        <div className="grid gap-3">
            {documents.map((document) => (
                <DocumentRow document={document} key={document.path} />
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

function documentsForView(dashboard: WorkspaceDashboard, view: WorkspaceDashboard["views"][number]) {
    return view.space ? dashboard.documents.filter((document) => document.space === view.space) : dashboard.documents;
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

    if (!item.documentId) {
        return <div className="p-4">{content}</div>;
    }

    return (
        <Link
            className="hover:bg-accent/50 focus-visible:ring-ring/50 block p-4 transition-colors outline-none focus-visible:ring-3"
            to={`/documents/${item.documentId}`}
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
                                <th className="px-4 py-3 text-start font-medium" key={column}>
                                    {formatViewColumnLabel(column)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {projection.items.map((item) => (
                            <tr className="border-border hover:bg-accent/50 border-b last:border-b-0" key={item.path}>
                                {projection.columns.map((column) => (
                                    <td className="max-w-80 px-4 py-3 align-top" key={`${item.path}-${column}`}>
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

function ViewProjectionCell({ column, item }: { column: string; item: DashboardViewProjectionItem }) {
    if (column === "title") {
        return <ViewProjectionItemLink item={item} />;
    }

    if (column === "path") {
        return (
            <code className="text-muted-foreground block truncate text-xs" title={item.path}>
                {item.path}
            </code>
        );
    }

    const value = item.fields[column] ?? "";

    return (
        <span className="text-muted-foreground block truncate" title={value}>
            {value || "—"}
        </span>
    );
}

function ViewProjectionItemLink({ item }: { item: DashboardViewProjectionItem }) {
    const content = (
        <>
            <span className="block truncate font-medium" title={item.title}>
                {item.title}
            </span>
            <span className="text-muted-foreground mt-1 block truncate text-xs" title={item.path}>
                {item.path}
            </span>
        </>
    );

    if (!item.documentId) {
        return <div className="min-w-0">{content}</div>;
    }

    return (
        <Link
            className="focus-visible:ring-ring/50 block min-w-0 rounded-sm outline-none focus-visible:ring-3"
            to={`/documents/${item.documentId}`}
        >
            {content}
        </Link>
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

    if (!item.documentId) {
        return <div className="bg-card rounded-md border p-3 shadow-sm">{content}</div>;
    }

    return (
        <Link
            className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 rounded-md border p-3 shadow-sm transition-colors outline-none focus-visible:ring-3"
            to={`/documents/${item.documentId}`}
        >
            {content}
        </Link>
    );
}

function formatViewColumnLabel(column: string) {
    return column
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
                <StatCell label="Entries" value={space.entryCount} />
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
                    <Metric icon={FileText} label="Documents" value={dashboard.documents.length} />
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

function SpaceCard({ documentCount, space }: { documentCount: number; space: DashboardSpace }) {
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
                        <StatCell label="Entries" value={space.entryCount} />
                        <StatCell label="Documents" value={documentCount} />
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

function DocumentRow({ document }: { document: DashboardDocument }) {
    return (
        <Link
            className="border-border bg-card group hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 flex min-w-0 flex-col gap-3 rounded-lg border p-4 shadow-sm transition-colors outline-none focus-visible:ring-3 sm:flex-row sm:items-center"
            to={`/documents/${document.id}`}
        >
            <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                <FileText data-icon="inline-start" />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium" title={document.title}>
                    {document.title}
                </h3>
                <p className="text-muted-foreground truncate text-sm" title={document.summary}>
                    {document.summary}
                </p>
                <code className="text-muted-foreground mt-2 block truncate text-xs" title={document.path}>
                    {document.path}
                </code>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                <Badge variant="outline">{document.space}</Badge>
                <span className="text-muted-foreground text-xs" title={formatAbsoluteDateTime(document.updatedAt)}>
                    {document.updatedLabel}
                </span>
            </div>
        </Link>
    );
}

function healthVariant(status: WorkspaceHealth) {
    return status === "failed" ? "destructive" : status === "warning" ? "secondary" : "default";
}
