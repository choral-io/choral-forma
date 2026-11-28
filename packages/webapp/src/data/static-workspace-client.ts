import { formatRelativeDateTime } from "@/lib/date-time";
import type { CalendarProjection, GanttProjection, ReferenceEdge, ViewRenderDocument } from "@choral-forma/shared";

import { stringifyStaticFieldValue } from "./static-field-value";
import { canonicalRoutePath } from "./static-route-target";
import {
    requireStaticArtifact,
    staticDataSchemaVersion,
    type StaticRouteTarget,
    type StaticRuntimeConfig,
} from "./static-runtime";
import type {
    DashboardDiagnostic,
    DashboardDirectory,
    DashboardEntry,
    DashboardEntryHeading,
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
    WorkspaceDashboardContext,
    WorkspaceHealth,
} from "./workspace-client";
import { createWorkspaceDashboardContext, latestUpdatedAt, mapEntryRelations } from "./workspace-client";

type StaticStatus = "passed" | "warning" | "failed";

type StaticDiagnostic = DashboardDiagnostic & { routePath?: string };

export interface StaticDashboardData {
    schemaVersion: number;
    artifactId: string;
    routes: StaticRouteTarget[];
    directories: StaticDirectorySummary[];
    generatorVersion: string;
    status: StaticStatus;
    workspace: {
        name: string;
        canonicalLanguage: string;
        supportedLanguages: string[];
        home: {
            path: string;
            title?: string;
            omitLeadingTitle: boolean;
            updatedAt?: string;
            markdown: string;
            headings: { id: string; level: number; text: string }[];
        };
        logo?: { publicPath: string; alt: string };
    };
    spaces: {
        id: string;
        title: string;
        display?: DashboardSpace["display"];
        description?: string;
        entryPaths: string[];
    }[];
    taxonomies: {
        id: string;
        title: string;
        mode: string;
        display?: DashboardTaxonomy["display"];
        description?: string;
        routePath: string;
        terms: {
            id: string;
            title: string;
            display?: DashboardTaxonomy["display"];
            description?: string;
            routePath: string;
            entryPaths: string[];
        }[];
    }[];
    entries: StaticEntrySummary[];
    views: StaticViewSummary[];
    diagnostics: StaticDiagnostic[];
    summary: { errors: number; warnings: number; infos: number };
}

interface StaticEntrySummary {
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
}

interface StaticEntryVariant {
    id: string;
    language: string;
    path: string;
    routePath: string;
    kind?: string;
    title?: string;
    omitLeadingTitle: boolean;
    summary?: string;
    dataPath: string;
}

interface StaticEntryDetail {
    path: string;
    routePath: string;
    status?: StaticStatus;
    markdown: string;
    headings: { id: string; level: number; text: string }[];
    outgoing?: ReferenceEdge[];
    backlinks?: ReferenceEdge[];
    diagnostics?: StaticDiagnostic[];
    language?: string;
}

interface StaticDirectorySummary {
    path: string;
    routePath: string;
    outputPath: string;
    introduction?: DashboardDirectory["introduction"];
    childDirectoryPaths: string[];
    entryPaths: string[];
}

interface StaticViewSummary {
    id: string;
    configId: string;
    publicId: string;
    sourcePath: string;
    routePath: string;
    mode: string;
    title?: string;
    display?: DashboardView["display"];
    space?: string;
    status: StaticStatus;
    dataPath: string;
}

export interface StaticViewData extends StaticViewSummary {
    document?: ViewRenderDocument;
    projection?: unknown;
}

type TableProjection = Extract<DashboardViewProjection, { kind: "table" }>;
type KanbanProjection = Extract<DashboardViewProjection, { kind: "kanban" }>;
type GraphProjection = Extract<DashboardViewProjection, { kind: "graph" }>;

export class StaticWorkspaceClient implements WorkspaceClient {
    readonly #readConfig: () => StaticRuntimeConfig | undefined;
    #manifest?: { data: StaticDashboardData; dashboard: WorkspaceDashboard; routes: Map<string, StaticRouteTarget> };
    #readingDashboard?: Promise<WorkspaceDashboard>;
    readonly #entryDetails = new Map<string, Promise<DashboardEntry>>();
    readonly #viewDetails = new Map<string, Promise<DashboardViewRender>>();

    constructor(config: StaticRuntimeConfig | (() => StaticRuntimeConfig | undefined)) {
        this.#readConfig = typeof config === "function" ? config : () => config;
    }

    async getDashboard(): Promise<WorkspaceDashboard> {
        if (this.#manifest) return this.#manifest.dashboard;
        this.#readingDashboard ??= this.#loadDashboard();
        try {
            return await this.#readingDashboard;
        } finally {
            this.#readingDashboard = undefined;
        }
    }

    async #loadDashboard(): Promise<WorkspaceDashboard> {
        const data = await this.#readJson<StaticDashboardData>("dashboard.json");
        if (!isReadableStatus(data.status)) throw new Error("Static artifact manifest failed workspace validation.");
        const entries = [
            mapWorkspaceRootEntry(data.workspace.home, data.workspace.name),
            ...data.entries.map(mapEntrySummary),
        ];
        const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));
        const diagnostics = data.diagnostics;
        const health: DashboardHealth = { status: mapStatus(data.status), diagnostics, findings: [] };
        const dashboard: WorkspaceDashboard = {
            workspaceName: data.workspace.name,
            canonicalLanguage: data.workspace.canonicalLanguage,
            workspaceLogo: data.workspace.logo
                ? { url: data.workspace.logo.publicPath, alt: data.workspace.logo.alt }
                : undefined,
            tagline: "Markdown-backed workspace content.",
            status: maxHealth(mapStatus(data.status), health.status),
            spaces: data.spaces.map((space) => mapSpace(space, entriesByPath)),
            taxonomies: data.taxonomies.map((taxonomy) => mapTaxonomy(taxonomy, entriesByPath)),
            entries,
            directories: data.directories,
            diagnostics,
            health,
            views: data.views.map((view) => ({
                id: view.configId,
                path: view.sourcePath,
                configId: view.configId,
                publicId: view.publicId,
                sourcePath: view.sourcePath,
                routePath: view.routePath,
                title: view.title ?? view.publicId,
                display: view.display,
                description: "Configured workspace View.",
                kind: mapViewKind(view.mode),
                space: view.space,
            })),
        };
        const records = [
            ["entries", data.entries.flatMap((entry) => [entry, ...entry.variants])],
            ["views", data.views],
        ] as const;
        const dataPaths = new Set<string>();
        for (const [kind, details] of records) {
            for (const record of details) {
                const path = record.dataPath;
                if (
                    typeof path !== "string" ||
                    !path.startsWith(`${kind}/`) ||
                    !isDetailDataPath(path) ||
                    dataPaths.has(path)
                ) {
                    throw new Error(`Static artifact has competing or invalid data paths: ${path}`);
                }
                dataPaths.add(path);
            }
        }
        const routes = new Map<string, StaticRouteTarget>();
        for (const target of data.routes) {
            const path = canonicalRoutePath(target.path);
            if (path !== target.path || routes.has(path) || typeof target.id !== "string") {
                throw new Error(`Static artifact has competing or invalid routes: ${target.path}`);
            }
            routes.set(path, target);
        }
        this.#manifest = { data, dashboard, routes };
        return dashboard;
    }

    async verifyStaticBootstrap(pathname: string): Promise<void> {
        const config = requireStaticArtifact(this.#readConfig());
        await this.getDashboard();
        const target = this.#manifest?.routes.get(canonicalRoutePath(pathname));
        const initial = config.pageTarget;
        if (!target || !initial || target.path !== config.pageRoutePath || !sameStaticTarget(initial, target)) {
            throw new Error(`Static artifact HTML did not match the manifest route: ${pathname}`);
        }
    }

    hasStaticRoute(pathname: string): boolean {
        return this.#manifest?.routes.has(canonicalRoutePath(pathname)) ?? false;
    }

    async prepareStaticRoute(pathname: string): Promise<void> {
        const dashboard = await this.getDashboard();
        const target = this.#manifest?.routes.get(canonicalRoutePath(pathname));
        if (!target) throw new Error(`Static artifact route was not listed: ${pathname}`);
        const context = createWorkspaceDashboardContext(dashboard);
        switch (target.kind) {
            case "entry": {
                const entry = await this.getEntry(target.sourcePath ?? target.id, context);
                if (entry.routePath !== target.path)
                    throw new Error(`Static artifact entry route did not match: ${pathname}`);
                return;
            }
            case "directory": {
                const directory = this.#manifest?.data.directories.find((directory) => directory.path === target.id);
                if (directory?.routePath !== target.path || directory.outputPath !== target.outputPath) {
                    throw new Error(`Static artifact directory route did not match: ${pathname}`);
                }
                return;
            }
            case "view": {
                const view = dashboard.views.find(
                    (view) => view.configId === target.id && view.routePath === target.path,
                );
                if (!view) throw new Error(`Static artifact View route did not match: ${pathname}`);
                await this.getViewRender(target.id, context);
                return;
            }
            case "taxonomy":
            case "taxonomyTerm": {
                const matched = dashboard.taxonomies.some((taxonomy) =>
                    target.kind === "taxonomy"
                        ? taxonomy.id === target.id && taxonomy.routePath === target.path
                        : taxonomy.id === target.taxonomyId &&
                          taxonomy.terms.some((term) => term.id === target.id && term.routePath === target.path),
                );
                if (!matched) throw new Error(`Static artifact classification did not match: ${pathname}`);
                return;
            }
            case "home":
            case "taxonomies":
            case "views":
            case "health":
                return;
            default:
                throw new Error(`Static artifact has an unsupported target kind: ${pathname}`);
        }
    }

    async getEntry(entryPath: string, context: WorkspaceDashboardContext): Promise<DashboardEntry> {
        const { entriesByPath } = context;
        await this.getDashboard();
        const manifest = this.#manifest?.data;
        if (!manifest) throw new Error("Static artifact manifest is unavailable.");
        const registered = manifest.entries.find(
            (entry) => entry.path === entryPath || entry.variants.some((variant) => variant.path === entryPath),
        );
        if (!registered && entryPath === manifest.workspace.home.path)
            return mapWorkspaceRootEntry(manifest.workspace.home, manifest.workspace.name);
        if (!registered) throw new Error(`Static artifact entry was not listed: ${entryPath}`);
        const variant = registered.variants.find((variant) => variant.path === entryPath);
        const expected = variant ?? registered;
        const dataPath = expected.dataPath;
        if (!dataPath) throw new Error(`Static artifact data path was not listed: ${entryPath}`);
        return this.#getOrRead(this.#entryDetails, dataPath, async () => {
            const detail = await this.#readJson<StaticEntryDetail>(dataPath);
            if (
                detail.path !== expected.path ||
                detail.routePath !== expected.routePath ||
                (variant && detail.language !== variant.language)
            ) {
                throw new Error(`Static artifact entry identity did not match: ${entryPath}`);
            }
            if (
                typeof detail.markdown !== "string" ||
                !Array.isArray(detail.headings) ||
                (!variant && !isReadableStatus(detail.status))
            ) {
                throw new Error(`Static artifact entry payload is invalid: ${entryPath}`);
            }
            const summary = mapEntrySummary(registered);
            const title = expected.title?.trim() ?? "";
            const rendered = {
                ...summary,
                id: expected.id,
                kind: expected.kind,
                path: expected.path,
                rawPath: expected.path,
                routePath: expected.routePath,
                title: title.length === 0 ? expected.path : title,
                omitLeadingTitle: expected.omitLeadingTitle,
                summary: expected.summary ?? summary.summary,
                body: [
                    {
                        type: "markdown" as const,
                        markdown: detail.markdown,
                        anchors: detail.headings,
                        outline: detail.headings.filter(isDashboardHeading),
                    },
                ],
                diagnostics:
                    detail.diagnostics ??
                    manifest.diagnostics.filter(
                        (diagnostic) => diagnostic.path === detail.path || diagnostic.routePath === detail.routePath,
                    ),
                relations: mapEntryRelations(detail, entriesByPath),
            };
            return rendered;
        });
    }

    async getViewRender(viewId: string, context: WorkspaceDashboardContext): Promise<DashboardViewRender> {
        const { dashboard, entriesByPath } = context;
        await this.getDashboard();
        const summary = this.#manifest?.data.views.find((view) => view.configId === viewId);
        if (!summary) throw new Error(`Static artifact View was not listed: ${viewId}`);
        return this.#getOrRead(this.#viewDetails, summary.dataPath, async () => {
            const data = await this.#readJson<StaticViewData>(summary.dataPath);
            if (
                data.configId !== summary.configId ||
                data.sourcePath !== summary.sourcePath ||
                data.publicId !== summary.publicId ||
                data.routePath !== summary.routePath
            ) {
                throw new Error(`Static artifact View identity did not match: ${viewId}`);
            }
            if (!isReadableStatus(data.status)) throw new Error(`Static artifact View payload is invalid: ${viewId}`);
            const projection = mapViewProjection(data.projection, entriesByPath);
            if (projection.kind === "gantt") projection.canonicalLanguage = dashboard.canonicalLanguage;
            return { document: mapViewDocument(data, viewId), projection };
        });
    }

    #getOrRead<T>(cache: Map<string, Promise<T>>, key: string, read: () => Promise<T>): Promise<T> {
        const cached = cache.get(key);
        if (cached) return cached;
        const pending = read().catch((reason: unknown) => {
            cache.delete(key);
            throw reason;
        });
        cache.set(key, pending);
        return pending;
    }

    async #readJson<T>(relativePath: string): Promise<T> {
        const config = requireStaticArtifact(this.#readConfig());
        if (relativePath !== "dashboard.json" && !isDetailDataPath(relativePath)) {
            throw new Error(`Static artifact data path is invalid: ${relativePath}`);
        }
        const path = `${config.dataBaseUrl}/${relativePath}`;
        let response: Response;
        try {
            response = await fetch(path);
        } catch (reason) {
            throw new Error(`Static artifact data missing: ${path}`, { cause: reason });
        }
        if (!response.ok) throw new Error(`Static artifact data missing: ${path} (HTTP ${String(response.status)})`);
        let data: unknown;
        try {
            data = await response.json();
        } catch (reason) {
            throw new Error(`Static artifact data is invalid: ${path}`, { cause: reason });
        }
        if (
            !data ||
            typeof data !== "object" ||
            !("schemaVersion" in data) ||
            data.schemaVersion !== staticDataSchemaVersion ||
            !("artifactId" in data) ||
            data.artifactId !== config.artifactId
        ) {
            throw new Error(`Static artifact data did not match the build: ${path}`);
        }
        return data as T;
    }
}

function isDetailDataPath(path: string) {
    return /^(?:entries|directories|views)\/[0-9a-f]{64}\.json$/u.test(path);
}

function isReadableStatus(status: StaticStatus | undefined) {
    return status === "passed" || status === "warning";
}

function sameStaticTarget(left: StaticRouteTarget, right: StaticRouteTarget): boolean {
    return (
        left.id === right.id &&
        left.kind === right.kind &&
        left.path === right.path &&
        left.outputPath === right.outputPath &&
        left.sourcePath === right.sourcePath &&
        left.taxonomyId === right.taxonomyId
    );
}

function mapWorkspaceRootEntry(home: StaticDashboardData["workspace"]["home"], workspaceName: string): DashboardEntry {
    let homeTitle = home.title?.trim();
    if (homeTitle === undefined || homeTitle.length === 0) {
        homeTitle = workspaceName;
    }
    return {
        id: "workspace-root",
        path: home.path,
        routePath: "/",
        title: homeTitle,
        omitLeadingTitle: home.omitLeadingTitle,
        summary: "Markdown-backed workspace content.",
        space: "",
        updatedAt: home.updatedAt,
        updatedLabel: formatRelativeDateTime(home.updatedAt),
        status: "healthy",
        variants: [],
        body: [
            {
                type: "markdown",
                markdown: home.markdown,
                anchors: home.headings,
                outline: home.headings.filter(isDashboardHeading),
            },
        ],
        diagnostics: [],
        relations: { outgoing: [], backlinks: [] },
    };
}

function mapEntrySummary(entry: StaticEntrySummary): DashboardEntry {
    const title = entry.title?.trim();
    return {
        id: entry.id,
        kind: entry.kind,
        path: entry.path,
        routePath: entry.routePath,
        rawPath: entry.path,
        title: title === "" ? entry.path : (title ?? entry.path),
        omitLeadingTitle: entry.omitLeadingTitle,
        summary: entry.summary ?? "No summary provided.",
        space: entry.space,
        updatedLabel: "",
        status: mapStatus(entry.status),
        variants: entry.variants.map((variant) => ({
            id: variant.id,
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

function mapSpace(
    space: StaticDashboardData["spaces"][number],
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardSpace {
    const matchingEntries = space.entryPaths
        .map((path) => entriesByPath.get(path))
        .filter((entry): entry is DashboardEntry => Boolean(entry));
    const updatedAt = latestUpdatedAt(matchingEntries);
    return {
        id: space.id,
        title: space.title,
        display: space.display,
        description: space.description ?? "Configured workspace space.",
        entryCount: space.entryPaths.length,
        path: space.id,
        status: "healthy",
        updatedAt,
        updatedLabel: formatRelativeDateTime(updatedAt),
    };
}

function mapTaxonomy(
    taxonomy: StaticDashboardData["taxonomies"][number],
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardTaxonomy {
    return {
        id: taxonomy.id,
        title: taxonomy.title,
        mode: taxonomy.mode,
        routePath: taxonomy.routePath,
        display: taxonomy.display,
        description: taxonomy.description ?? "Configured workspace classification.",
        terms: taxonomy.terms.map((term) => ({
            id: term.id,
            title: term.title,
            routePath: term.routePath,
            display: term.display,
            description: term.description ?? "Configured classification term.",
            entryCount: term.entryPaths.length,
            entries: term.entryPaths
                .map((path) => entriesByPath.get(path))
                .filter((entry): entry is DashboardEntry => Boolean(entry)),
            status: "healthy",
        })),
    };
}

function isDashboardHeading(heading: { id: string; level: number; text: string }): heading is DashboardEntryHeading {
    return heading.level === 2 || heading.level === 3;
}

function mapViewDocument(data: StaticViewData, viewId: string): DashboardViewRender["document"] {
    const source = data.document?.bodySource ?? "";
    const mount = data.document?.mounts?.[0];
    const headings = data.document?.headings;
    const path = data.sourcePath || viewId;
    if (!mount) return { beforeProjection: source, afterProjection: "", headings, path };
    return {
        beforeProjection: source.slice(0, mount.startOffset),
        afterProjection: source.slice(mount.endOffset),
        hasProjectionMount: true,
        headings,
        path,
    };
}

function mapViewProjection(
    value: unknown,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardViewProjection {
    const projection = readProjection(value);
    if (!projection) {
        return { kind: "list", items: [] };
    }
    if (projection.kind === "calendar" || projection.kind === "gantt") {
        return {
            ...(projection as unknown as CalendarProjection | GanttProjection),
            routes: Object.fromEntries([...entriesByPath].map(([path, entry]) => [path, entry.routePath])),
        };
    }
    if (projection.kind === "list") {
        const items = Array.isArray(projection.items) ? projection.items : [];
        return { kind: "list", items: mapViewItems(items, entriesByPath) };
    }
    if (projection.kind === "table") {
        const columns = Array.isArray(projection.columns) ? (projection.columns as TableProjection["columns"]) : [];
        const items = Array.isArray(projection.items) ? projection.items : [];
        return {
            kind: "table",
            columns,
            items: mapViewItems(items, entriesByPath),
        };
    }
    if (projection.kind === "kanban") {
        const columns = (Array.isArray(projection.columns) ? projection.columns : []) as {
            id: string;
            label: string;
            icon?: string;
            items?: unknown[];
        }[];
        return {
            kind: "kanban",
            card: projection.card as KanbanProjection["card"],
            columns: columns.map((column) => ({
                ...column,
                items: mapViewItems(column.items ?? [], entriesByPath),
            })),
        };
    }
    if (projection.kind === "graph") {
        return {
            kind: "graph",
            nodes: Array.isArray(projection.nodes) ? (projection.nodes as GraphProjection["nodes"]) : [],
            edges: Array.isArray(projection.edges) ? (projection.edges as GraphProjection["edges"]) : [],
            legend: Array.isArray(projection.legend) ? (projection.legend as GraphProjection["legend"]) : [],
        };
    }
    throw new Error("Unsupported View projection. Update the client to match the static export.");
}

function readProjection(value: unknown): { kind?: string; [key: string]: unknown } | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return undefined;
    }
    return value as { kind?: string; [key: string]: unknown };
}

function mapViewItems(
    items: unknown[],
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardViewProjectionItem[] {
    return items.map((item) => {
        const value = item as { path: string; title?: string; fields?: Record<string, DashboardViewFieldValue> };
        const entry = entriesByPath.get(value.path);
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
    return stringifyStaticFieldValue(field.value);
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
    return kind === "table" ||
        kind === "kanban" ||
        kind === "graph" ||
        kind === "list" ||
        kind === "calendar" ||
        kind === "gantt"
        ? kind
        : "list";
}
