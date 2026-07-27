import { formatRelativeDateTime } from "@/lib/date-time";

import type {
    DashboardDiagnostic,
    DashboardEntry,
    DashboardEntryHeading,
    DashboardEntryLink,
    DashboardHealth,
    DashboardSpace,
    DashboardTaxonomy,
    DashboardView,
    DashboardViewFieldValue,
    DashboardViewProjection,
    DashboardViewProjectionItem,
    DashboardViewRender,
    WorkspaceClient,
    WorkspaceDashboard,
    WorkspaceHealth,
} from "./workspace-client";

declare global {
    var __FORMA_STATIC_WORKSPACE__: { dataBaseUrl: string } | undefined;
}

type StaticStatus = "passed" | "warning" | "failed";

type StaticDiagnostic = DashboardDiagnostic & { routePath?: string };

export type StaticDashboardData = {
    schemaVersion: number;
    generatorVersion: string;
    status: StaticStatus;
    workspace: {
        name: string;
        canonicalLanguage: string;
        supportedLanguages: string[];
        logo?: { publicPath: string; alt: string };
    };
    spaces: Array<{
        id: string;
        title: string;
        display?: DashboardSpace["display"];
        description?: string;
        entryIds: string[];
    }>;
    taxonomies: Array<{
        id: string;
        title: string;
        mode: string;
        display?: DashboardTaxonomy["display"];
        description?: string;
        routePath: string;
        terms: Array<{
            id: string;
            title: string;
            display?: DashboardTaxonomy["display"];
            description?: string;
            routePath: string;
            entryIds: string[];
        }>;
    }>;
    entries: StaticEntrySummary[];
    views: StaticViewSummary[];
    diagnostics: StaticDiagnostic[];
    summary: { errors: number; warnings: number; infos: number };
};

type StaticEntrySummary = {
    id: string;
    path: string;
    routePath: string;
    space: string;
    kind?: string;
    title?: string;
    omitLeadingTitle: boolean;
    summary?: string;
    status: StaticStatus;
    variants: StaticEntryVariant[];
    dataPath: string;
};

type StaticEntryVariant = {
    id: string;
    language: string;
    path: string;
    routePath: string;
    kind?: string;
    title?: string;
    omitLeadingTitle: boolean;
    summary?: string;
};

export type StaticEntryData = StaticEntrySummary & {
    markdown: string;
    html: string;
    headings: Array<{ id: string; level: number; text: string }>;
    outgoing: StaticReferenceEdge[];
    backlinks: StaticReferenceEdge[];
    diagnostics?: StaticDiagnostic[];
};

type StaticReferenceEdge = {
    targetPath?: string;
    targetRoutePath?: string;
    targetEntryId?: string;
    target?: string;
    label?: string;
    intent?: string;
};

type StaticViewSummary = {
    id: string;
    routePath: string;
    mode: string;
    title?: string;
    display?: DashboardView["display"];
    space?: string;
    status: StaticStatus;
    dataPath: string;
};

export type StaticViewData = StaticViewSummary & {
    document?: {
        bodySource: string;
        mounts?: Array<{ startOffset: number; endOffset: number }>;
    };
    projection?: unknown;
};

type TableProjection = Extract<DashboardViewProjection, { kind: "table" }>;
type KanbanProjection = Extract<DashboardViewProjection, { kind: "kanban" }>;
type GraphProjection = Extract<DashboardViewProjection, { kind: "graph" }>;

export class StaticWorkspaceClient implements WorkspaceClient {
    #dashboard: WorkspaceDashboard | undefined;
    private readonly dataBaseUrl: string;

    constructor(dataBaseUrl: string) {
        this.dataBaseUrl = dataBaseUrl;
    }

    async getDashboard(): Promise<WorkspaceDashboard> {
        const data = await this.readJson<StaticDashboardData>("dashboard.json");
        const entries = data.entries.map(mapEntrySummary);
        const diagnostics = data.diagnostics ?? [];
        const health: DashboardHealth = {
            status: mapStatus(data.status),
            diagnostics,
            findings: [],
        };

        this.#dashboard = {
            workspaceName: data.workspace.name,
            workspaceLogo: data.workspace.logo
                ? { url: data.workspace.logo.publicPath, alt: data.workspace.logo.alt }
                : undefined,
            tagline: "Markdown-backed workspace content.",
            status: maxHealth(mapStatus(data.status), health.status),
            spaces: data.spaces.map((space) => mapSpace(space, entries)),
            taxonomies: data.taxonomies.map((taxonomy) => mapTaxonomy(taxonomy, entries)),
            entries,
            diagnostics,
            health,
            views: data.views.map((view) => ({
                id: view.id,
                path: view.id,
                title: view.title ?? view.id,
                display: view.display,
                description: "Configured workspace View.",
                kind: mapViewKind(view.mode),
                space: view.space,
            })),
        };
        return this.#dashboard;
    }

    async getEntry(entryId: string): Promise<DashboardEntry> {
        const dashboard = this.#dashboard ?? (await this.getDashboard());
        const summary = dashboard.entries.find((entry) => entry.id === entryId);
        if (!summary) {
            throw new Error(`Static artifact entry was not listed: ${entryId}`);
        }
        const data = await this.readJson<StaticEntryData>(`entries/${entryId}.json`);
        return {
            ...mapEntrySummary(data),
            body: [
                {
                    type: "markdown",
                    markdown: data.markdown,
                    outline: data.headings.filter(isDashboardHeading),
                },
            ],
            diagnostics: data.diagnostics ?? [],
            relations: {
                outgoing: data.outgoing.map((edge) => mapReference(edge, dashboard.entries)),
                backlinks: data.backlinks.map((edge) => mapReference(edge, dashboard.entries)),
            },
        };
    }

    async getViewRender(viewId: string): Promise<DashboardViewRender> {
        const dashboard = this.#dashboard ?? (await this.getDashboard());
        const summary = dashboard.views.find((view) => view.id === viewId);
        if (!summary) {
            throw new Error(`Static artifact View was not listed: ${viewId}`);
        }
        const data = await this.readJson<StaticViewData>(`views/${viewId}.json`);
        return {
            document: mapViewDocument(data, viewId),
            projection: mapViewProjection(data.projection, dashboard.entries),
        };
    }

    private async readJson<T>(relativePath: string): Promise<T> {
        const path = `${this.dataBaseUrl.replace(/\/$/, "")}/${relativePath}`;
        let response: Response;
        try {
            response = await fetch(path);
        } catch (reason) {
            throw new Error(`Static artifact data missing: ${path} (${String(reason)})`);
        }
        if (!response.ok) {
            throw new Error(`Static artifact data missing: ${path} (HTTP ${response.status})`);
        }
        try {
            return (await response.json()) as T;
        } catch (reason) {
            throw new Error(`Static artifact data is invalid: ${path} (${String(reason)})`);
        }
    }
}

function mapEntrySummary(entry: StaticEntrySummary): DashboardEntry {
    return {
        id: entry.id,
        kind: entry.kind,
        path: entry.path,
        routePath: entry.routePath,
        rawPath: entry.path,
        title: entry.title?.trim() || entry.path,
        omitLeadingTitle: entry.omitLeadingTitle,
        summary: entry.summary ?? "No summary provided.",
        space: entry.space,
        updatedLabel: "",
        status: mapStatus(entry.status),
        variants: entry.variants.map((variant) => ({
            language: variant.language,
            path: variant.path,
            routePath: variant.routePath,
            rawPath: variant.path,
            kind: variant.kind,
            title: variant.title,
            omitLeadingTitle: variant.omitLeadingTitle,
            summary: variant.summary,
        })),
        body: [{ type: "paragraph", text: entry.summary ?? "No summary provided." }],
        diagnostics: [],
        relations: { outgoing: [], backlinks: [] },
    };
}

function mapSpace(space: StaticDashboardData["spaces"][number], entries: DashboardEntry[]): DashboardSpace {
    const matchingEntries = entries.filter((entry) => space.entryIds.includes(entry.id));
    const updatedAt = matchingEntries.map((entry) => entry.updatedAt).find(Boolean);
    return {
        id: space.id,
        title: space.title,
        display: space.display,
        description: space.description ?? "Configured workspace space.",
        entryCount: space.entryIds.length,
        path: space.id,
        status: "healthy",
        updatedAt,
        updatedLabel: formatRelativeDateTime(updatedAt),
    };
}

function mapTaxonomy(
    taxonomy: StaticDashboardData["taxonomies"][number],
    entries: DashboardEntry[],
): DashboardTaxonomy {
    return {
        id: taxonomy.id,
        title: taxonomy.title,
        mode: taxonomy.mode,
        display: taxonomy.display,
        description: taxonomy.description ?? "Configured workspace classification.",
        terms: taxonomy.terms.map((term) => ({
            id: term.id,
            title: term.title,
            display: term.display,
            description: term.description ?? "Configured classification term.",
            entryCount: term.entryIds.length,
            entries: entries.filter((entry) => term.entryIds.includes(entry.id)),
            status: "healthy",
        })),
    };
}

function mapReference(edge: StaticReferenceEdge, entries: DashboardEntry[]): DashboardEntryLink {
    const targetPath = edge.targetPath ?? edge.target ?? "";
    const target = entries.find((entry) => entry.path === targetPath);
    return {
        kind: edge.targetRoutePath || target ? "internal" : "unresolved",
        label: edge.label ?? targetPath,
        targetEntryId: edge.targetEntryId ?? target?.id,
        targetRoutePath: edge.targetRoutePath ?? target?.routePath,
        targetPath,
    };
}

function isDashboardHeading(heading: { id: string; level: number; text: string }): heading is DashboardEntryHeading {
    return heading.level === 2 || heading.level === 3;
}

function mapViewDocument(data: StaticViewData, viewId: string): DashboardViewRender["document"] {
    const source = data.document?.bodySource ?? "";
    const mount = data.document?.mounts?.[0];
    if (!mount) return { beforeProjection: source, afterProjection: "", path: viewId };
    return {
        beforeProjection: source.slice(0, mount.startOffset),
        afterProjection: source.slice(mount.endOffset),
        path: viewId,
    };
}

function mapViewProjection(value: unknown, entries: DashboardEntry[]): DashboardViewProjection {
    const projection = value as { kind?: string; [key: string]: unknown } | undefined;
    if (!projection || projection.kind === "list") {
        return { kind: "list", items: mapViewItems((projection?.items as unknown[]) ?? [], entries) };
    }
    if (projection.kind === "table") {
        return {
            kind: "table",
            columns: (projection.columns as TableProjection["columns"]) ?? [],
            items: mapViewItems((projection.items as unknown[]) ?? [], entries),
        };
    }
    if (projection.kind === "kanban") {
        const columns =
            (projection.columns as Array<{ id: string; label: string; icon?: string; items?: unknown[] }>) ?? [];
        return {
            kind: "kanban",
            card: projection.card as KanbanProjection["card"],
            columns: columns.map((column) => ({ ...column, items: mapViewItems(column.items ?? [], entries) })),
        };
    }
    if (projection.kind === "graph") {
        return {
            kind: "graph",
            nodes: (projection.nodes as GraphProjection["nodes"]) ?? [],
            edges: (projection.edges as GraphProjection["edges"]) ?? [],
            legend: (projection.legend as GraphProjection["legend"]) ?? [],
        };
    }
    return { kind: "list", items: [] };
}

function mapViewItems(items: unknown[], entries: DashboardEntry[]): DashboardViewProjectionItem[] {
    return items.map((item) => {
        const value = item as { path: string; title?: string; fields?: Record<string, DashboardViewFieldValue> };
        const entry = entries.find((candidate) => candidate.path === value.path);
        const rawFields = value.fields ?? {};
        return {
            entryId: entry?.id,
            routePath: entry?.routePath,
            fields: Object.fromEntries(Object.entries(rawFields).map(([key, field]) => [key, formatField(field)])),
            rawFields,
            path: value.path,
            title: value.title ?? entry?.title ?? value.path,
        };
    });
}

function formatField(field: DashboardViewFieldValue): string {
    if (field.kind === "reference") return field.reference.title;
    if (field.kind === "referenceList") return field.references.map((reference) => reference.title).join(", ");
    return typeof field.value === "string" ? field.value : JSON.stringify(field.value);
}

function mapStatus(status: StaticStatus): WorkspaceHealth {
    return status === "passed" ? "healthy" : status;
}

function maxHealth(left: WorkspaceHealth, right: WorkspaceHealth): WorkspaceHealth {
    if (left === "failed" || right === "failed") return "failed";
    if (left === "warning" || right === "warning") return "warning";
    return "healthy";
}

function mapViewKind(kind: string): DashboardView["kind"] {
    return kind === "table" || kind === "kanban" || kind === "graph" || kind === "list" ? kind : "list";
}
