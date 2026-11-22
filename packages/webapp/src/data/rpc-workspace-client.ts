import {
    FormaRpcClient,
    type BaseOperationResult,
    type Diagnostic,
    type FileReferencesResult,
    type FileRenderResult,
    type OperationStatus,
    type ReferenceEdge,
    type ViewRenderFieldValue,
    type ViewRenderItem,
    type ViewRenderOutput,
    type ViewRenderResult,
    type WorkspaceDashboardResult,
    type WorkspaceHealthFinding,
    type WorkspaceHealthResult,
} from "@choral-forma/shared";

import { rpcEndpointPath } from "@/lib/workspace-routes";

import { formatRelativeDateTime } from "@/lib/date-time";
import { isExternalHref, normalizeWorkspaceHref } from "@/lib/workspace-links";
import { dashboardEntryByPath } from "./static-route-target";
import type {
    DashboardDiagnostic,
    DashboardEntry,
    DashboardEntryBlock,
    DashboardEntryHeading,
    DashboardEntryLink,
    DashboardHealth,
    DashboardHealthFinding,
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
import { latestUpdatedAt } from "./workspace-client";

export class RouteReadError extends Error {
    readonly code: "route.generationMismatch" | "route.unavailable" | "route.superseded";
    readonly routeGeneration?: string;

    constructor(code: RouteReadError["code"], routeGeneration?: string) {
        super(code === "route.unavailable" ? "Workspace routes are unavailable." : "Workspace routes have changed.");
        this.code = code;
        this.routeGeneration = routeGeneration;
    }
}

function validateGeneration(
    result: Omit<BaseOperationResult, "schemaVersion"> & { schemaVersion: number },
    expected?: string,
): string {
    const generation = result.routeGeneration;
    if (!generation || result.schemaVersion !== 1) throw new Error("Unsupported Forma route response.");
    for (const diagnostic of result.diagnostics ?? []) {
        if (diagnostic.code === "route.unavailable" || diagnostic.code === "route.generationMismatch") {
            throw new RouteReadError(diagnostic.code, generation);
        }
    }
    if (expected !== undefined && generation !== expected) {
        throw new RouteReadError("route.generationMismatch", generation);
    }
    return generation;
}

export class RpcWorkspaceClient implements WorkspaceClient {
    readonly #rpc: FormaRpcClient;
    #generation: string | undefined;
    #epoch = 0;
    #dashboardAttempt = 0;
    #healthAttempt = 0;
    readonly #invalidations = new Set<(error: RouteReadError) => void>();

    constructor(endpoint = rpcEndpointPath) {
        this.#rpc = new FormaRpcClient(endpoint);
    }

    async getDashboard(): Promise<WorkspaceDashboard> {
        const attempt = ++this.#dashboardAttempt;
        let epoch = this.#epoch;
        try {
            const result = await this.#rpc.workspaceDashboard();
            this.#checkAttempt(epoch, attempt === this.#dashboardAttempt);
            const generation = validateGeneration(result);
            if (result.routeProjectionVersion !== 2) {
                throw new Error(
                    "Unsupported Forma dashboard route projection. Use a WebApp and Forma server from the same release.",
                );
            }
            if (!Array.isArray(result.directories) || !result.canonicalLanguage) {
                throw new Error("Invalid Forma dashboard route projection.");
            }
            if (generation !== this.#generation) {
                this.#generation = undefined;
                epoch = ++this.#epoch;
            }
            const health = await this.#rpc.workspaceHealth(generation);
            this.#checkAttempt(epoch, attempt === this.#dashboardAttempt);
            validateGeneration(health, generation);
            const dashboard = mapWorkspaceDashboard(result, health);
            this.#generation = generation;
            return dashboard;
        } catch (error) {
            this.#checkAttempt(epoch, attempt === this.#dashboardAttempt);
            this.#invalidate(error);
            throw error;
        }
    }

    async getHealth(): Promise<DashboardHealth> {
        const epoch = this.#epoch;
        const attempt = ++this.#healthAttempt;
        let health: WorkspaceHealthResult;
        try {
            health = await this.#rpc.workspaceHealth();
        } catch (error) {
            this.#checkAttempt(epoch, attempt === this.#healthAttempt);
            throw error;
        }
        this.#checkAttempt(epoch, attempt === this.#healthAttempt);
        try {
            validateGeneration(health, this.#generation);
        } catch (error) {
            this.#invalidate(error);
            if (!(error instanceof RouteReadError)) throw error;
        }
        return mapDashboardHealth(health, new Map());
    }

    subscribeInvalidation(listener: (error: RouteReadError) => void): () => void {
        this.#invalidations.add(listener);
        return () => this.#invalidations.delete(listener);
    }

    #checkAttempt(epoch: number, active = true) {
        if (!active || epoch !== this.#epoch) throw new RouteReadError("route.superseded");
    }

    #invalidate(error: unknown) {
        if (error instanceof RouteReadError && error.code !== "route.superseded") {
            const notify = this.#generation !== undefined;
            this.#generation = undefined;
            this.#epoch++;
            if (notify) {
                for (const listener of this.#invalidations) listener(error);
            }
        }
    }

    async #readFor<T>(context: WorkspaceDashboardContext, read: (generation: string) => Promise<T>): Promise<T> {
        const generation = context.dashboard.routeGeneration;
        if (!generation || generation !== this.#generation) throw new RouteReadError("route.superseded");
        const epoch = this.#epoch;
        try {
            const detail = await read(generation);
            this.#checkAttempt(epoch);
            return detail;
        } catch (error) {
            this.#checkAttempt(epoch);
            this.#invalidate(error);
            throw error;
        }
    }

    async getEntry(entryPath: string, context: WorkspaceDashboardContext): Promise<DashboardEntry> {
        const { dashboard, entriesByPath } = context;
        const entry = dashboardEntryByPath(dashboard, entryPath);

        if (!entry) {
            throw new Error(`Entry not found: ${entryPath}`);
        }

        if (entry.id === "workspace-root") {
            return entry;
        }

        return this.#readFor(context, async (generation) => {
            const [renderResult, referencesResult] = await Promise.all([
                this.#rpc.renderFile(entry.path, "markdown", generation),
                this.#rpc.listFileReferences(entry.path, generation),
            ]);
            validateGeneration(renderResult, generation);
            validateGeneration(referencesResult, generation);
            const { file: renderedFile } = renderResult as Partial<FileRenderResult>;
            const { file: referencedFile } = referencesResult as Partial<FileReferencesResult>;
            if (renderedFile?.path !== entry.path || referencedFile?.path !== entry.path) {
                throw new Error("Forma entry response does not match its requested source path.");
            }
            return mapEntryDetail(entry, renderResult, referencesResult, entriesByPath);
        });
    }

    async getViewRender(viewId: string, context: WorkspaceDashboardContext): Promise<DashboardViewRender> {
        const { entriesByPath } = context;
        return this.#readFor(context, async (generation) => {
            const result = await this.#rpc.renderView(viewId, generation);
            validateGeneration(result, generation);
            if (!result.render || result.view?.id !== viewId) {
                throw new Error(`View render output not found: ${viewId}`);
            }
            const projection = mapViewProjection(result.render, entriesByPath);
            if (projection.kind === "gantt") projection.canonicalLanguage = context.dashboard.canonicalLanguage;
            return { document: mapViewDocument(result, viewId), projection };
        });
    }
}

function mapViewDocument(result: ViewRenderResult, viewId: string): DashboardViewRender["document"] {
    const bodySource = result.document?.bodySource ?? "";
    const mount = result.document?.mounts?.[0];
    const path = result.view?.path ?? viewId;
    const headings = result.document?.headings;

    if (!mount) {
        return {
            afterProjection: "",
            beforeProjection: bodySource,
            headings,
            path,
        };
    }

    const startOffset = Math.max(0, Math.min(bodySource.length, mount.startOffset));
    const endOffset = Math.max(startOffset, Math.min(bodySource.length, mount.endOffset));

    return {
        afterProjection: bodySource.slice(endOffset),
        beforeProjection: bodySource.slice(0, startOffset),
        hasProjectionMount: true,
        headings,
        path,
    };
}

function mapWorkspaceDashboard(
    result: WorkspaceDashboardResult,
    healthResult: WorkspaceHealthResult,
): WorkspaceDashboard {
    const entries = [mapWorkspaceRootEntry(result.home, result.workspace.name), ...result.entries.map(mapEntry)];
    const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));
    const health = mapDashboardHealth(healthResult, entriesByPath);
    const diagnostics = mergeDiagnostics(result.diagnostics, healthResult.diagnostics);

    return {
        workspaceName: result.workspace.name,
        canonicalLanguage: result.canonicalLanguage,
        routeGeneration: result.routeGeneration,
        directories: result.directories ?? [],
        workspaceLogo: result.workspace.logo,
        tagline: "Markdown-backed workspace content.",
        status: maxHealth(mapStatus(result.status), health.status),
        taxonomies: result.taxonomies.map((taxonomy) => mapTaxonomy(taxonomy, entriesByPath)),
        spaces: result.spaces.map((space) => mapSpace(space, entries)),
        entries,
        diagnostics,
        health,
        views: result.views.map(mapView),
    };
}

function mapWorkspaceRootEntry(home: WorkspaceDashboardResult["home"], workspaceName: string): DashboardEntry {
    return {
        id: "workspace-root",
        path: home.path,
        routePath: "/",
        title: nonBlankText(home.title) ?? workspaceName,
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
                outline: home.headings.filter(isReaderHeading),
            },
        ],
        diagnostics: [],
        relations: { outgoing: [], backlinks: [] },
    };
}

function isReaderHeading(heading: {
    id: string;
    level: number;
    text: string;
}): heading is { id: string; level: 2 | 3; text: string } {
    return heading.level === 2 || heading.level === 3;
}

function mapTaxonomy(
    taxonomy: WorkspaceDashboardResult["taxonomies"][number],
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardTaxonomy {
    return {
        id: taxonomy.id,
        routePath: requiredRoutePath(taxonomy.routePath),
        title: taxonomy.title,
        mode: taxonomy.mode,
        display: taxonomy.display,
        description: taxonomy.description ?? "Configured workspace classification.",
        terms: taxonomy.terms.map((term) => ({
            id: term.id,
            routePath: requiredRoutePath(term.routePath),
            title: term.title,
            display: term.display,
            description: term.description ?? "Configured classification term.",
            entryCount: term.entryCount,
            entries: term.entries.map((termEntry) => {
                const entry = entriesByPath.get(termEntry.path);
                return entry ?? mapEntry(termEntry);
            }),
            status: mapStatus(term.status),
        })),
    };
}

function mapDashboardHealth(
    result: BaseOperationResult & { findings?: WorkspaceHealthFinding[] },
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardHealth {
    return {
        status: mapStatus(result.status),
        diagnostics: (result.diagnostics ?? []).map(mapDiagnostic),
        findings: (result.findings ?? []).map((finding) => mapHealthFinding(finding, entriesByPath)),
    };
}

function mapHealthFinding(
    finding: WorkspaceHealthFinding,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardHealthFinding {
    const entry = entriesByPath.get(finding.path);

    return {
        category: finding.category,
        message: finding.message,
        path: finding.path,
        routePath: entry?.routePath,
        severity: finding.severity,
        target: finding.target,
        title: entry?.title,
    };
}

function mapSpace(space: WorkspaceDashboardResult["spaces"][number], entries: DashboardEntry[]): DashboardSpace {
    const updatedAt = latestUpdatedAt(entries.filter((entry) => entry.space === space.id));

    return {
        id: space.id,
        title: space.title,
        display: space.display,
        description: `Pages matched by ${space.include}.`,
        entryCount: space.entryCount,
        path: space.include,
        status: mapStatus(space.status),
        updatedAt,
        updatedLabel: formatRelativeDateTime(updatedAt),
    };
}

function mapEntry(entry: WorkspaceDashboardResult["entries"][number]): DashboardEntry {
    return {
        id: entry.id,
        kind: entry.kind,
        path: entry.path,
        routePath: requiredRoutePath(entry.routePath),
        rawPath: entry.rawPath,
        title: nonBlankText(entry.title) ?? entry.path.trim(),
        omitLeadingTitle: entry.omitLeadingTitle ?? false,
        summary: entry.summary ?? "No summary provided.",
        space: entry.space ?? "",
        updatedAt: entry.updatedAt,
        updatedLabel: formatRelativeDateTime(entry.updatedAt),
        status: mapStatus(entry.status),
        variants: (entry.variants ?? []).map((variant) => ({
            language: variant.language,
            path: variant.path,
            routePath: requiredRoutePath(variant.routePath),
            rawPath: variant.rawPath,
            kind: variant.kind,
            title: variant.title,
            omitLeadingTitle: variant.omitLeadingTitle,
            summary: variant.summary,
        })),
        body: [
            {
                type: "paragraph",
                text: entry.summary ?? "Open this page to render its Markdown source through the read-only RPC API.",
            },
        ],
        diagnostics: [],
        relations: {
            outgoing: [],
            backlinks: [],
        },
    };
}

function mapEntryDetail(
    entry: DashboardEntry,
    renderResult: FileRenderResult,
    referencesResult: FileReferencesResult,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardEntry {
    return {
        ...entry,
        title: nonBlankText(renderResult.file.title) ?? entry.title,
        omitLeadingTitle: renderResult.file.omitLeadingTitle ?? entry.omitLeadingTitle,
        summary: entry.summary,
        space: renderResult.file.space ?? entry.space,
        status: mapStatus(renderResult.status),
        body: mapRenderedBody(renderResult, entriesByPath),
        diagnostics: mergeDiagnostics(renderResult.diagnostics, referencesResult.diagnostics),
        relations: {
            outgoing: referencesResult.outgoing.map((edge) => mapReferenceEdge(edge, "outgoing", entriesByPath)),
            backlinks: referencesResult.backlinks.map((edge) => mapReferenceEdge(edge, "backlink", entriesByPath)),
        },
    };
}

function nonBlankText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed === "" ? undefined : trimmed;
}

function mapRenderedBody(
    result: FileRenderResult,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardEntryBlock[] {
    if (result.render.markdown) {
        return [
            {
                type: "markdown",
                markdown: result.render.markdown,
                outline: result.render.headings ?? [],
            },
        ];
    }

    if (result.render.html) {
        return [
            htmlToEntryBlock(
                result.render.html,
                result.render.headings ?? [],
                result.file.path,
                entriesByPath,
                result.file.omitLeadingTitle ?? false,
            ),
        ];
    }

    if (result.render.source) {
        return [
            {
                type: "code",
                language: "md",
                code: result.render.source,
            },
        ];
    }

    return [
        {
            type: "paragraph",
            text: "No renderable entry body was returned by file.render.",
        },
    ];
}

function htmlToEntryBlock(
    html: string,
    headings: DashboardEntryHeading[],
    currentPath: string,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
    omitLeadingTitle: boolean,
): DashboardEntryBlock {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    if (omitLeadingTitle && document.body.firstElementChild?.tagName === "H1") {
        document.body.firstElementChild.remove();
    }

    const elements = Array.from(document.body.querySelectorAll("h2, h3"));
    for (const [index, element] of elements.entries()) {
        const heading = headings[index];
        if (heading) {
            element.id = heading.id;
        }
    }

    const entries = Array.from(entriesByPath.values());
    for (const anchor of document.body.querySelectorAll("a[href]")) {
        const href = anchor.getAttribute("href");
        if (!href || isExternalHref(href) || href.startsWith("#")) {
            continue;
        }

        const targetPath = normalizeWorkspaceHref(href, currentPath, entries);
        const targetEntry = entriesByPath.get(targetPath.path);
        if (targetEntry) {
            anchor.setAttribute("href", `${targetEntry.routePath}${targetPath.hash}`);
        }
    }

    return {
        type: "html",
        html: document.body.innerHTML,
        outline: headings,
    };
}

function mapReferenceEdge(
    edge: ReferenceEdge,
    direction: "outgoing" | "backlink",
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardEntryLink {
    const targetPath = direction === "outgoing" ? edge.targetPath : edge.sourcePath;
    const targetTitle =
        direction === "outgoing" ? (edge.targetTitle ?? edge.targetPath) : (edge.sourceTitle ?? edge.sourcePath);
    const targetEntry = entriesByPath.get(targetPath);

    return {
        kind: mapReferenceKind(edge, targetEntry),
        label: targetTitle,
        targetEntryId: targetEntry?.id,
        targetRoutePath: targetEntry?.routePath,
        targetPath,
    };
}

function mapReferenceKind(edge: ReferenceEdge, targetEntry: DashboardEntry | undefined): DashboardEntryLink["kind"] {
    if (targetEntry) {
        return "internal";
    }

    return edge.targetPath.includes("://") ? "external" : "unresolved";
}

function mapView(view: WorkspaceDashboardResult["views"][number]): DashboardView {
    if (!view.configId || !view.sourcePath || !view.publicId) throw new Error("Missing Forma View route identity.");
    return {
        id: view.id,
        path: view.path,
        configId: view.configId,
        sourcePath: view.sourcePath,
        publicId: view.publicId,
        routePath: requiredRoutePath(view.routePath),
        title: view.title ?? view.id,
        display: view.display,
        space: view.space,
        description: view.space ? `Configured ${view.kind} view over ${view.space}.` : `Configured ${view.kind} view.`,
        kind: mapViewKind(view.kind),
    };
}

function requiredRoutePath(path: string | undefined): string {
    if (!path?.startsWith("/") || path.startsWith("//")) throw new Error("Missing Forma route projection.");
    return path;
}

function mapViewProjection(
    render: ViewRenderOutput,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardViewProjection {
    if (render.kind === "calendar" || render.kind === "gantt") {
        return {
            ...render,
            routes: Object.fromEntries([...entriesByPath].map(([path, entry]) => [path, entry.routePath])),
        };
    }
    if (render.kind === "list") {
        return {
            kind: "list",
            items: render.items.map((item) => mapViewProjectionItem(item, entriesByPath)),
        };
    }

    if (render.kind === "kanban") {
        return {
            kind: "kanban",
            card: {
                titleField: render.card.titleField,
                subtitleFields: render.card.subtitleFields ?? [],
                badgeFields: render.card.badgeFields ?? [],
            },
            columns: render.columns.map((column) => ({
                id: column.id,
                icon: column.icon,
                label: column.label,
                items: column.items.map((item) => mapViewProjectionItem(item, entriesByPath)),
            })),
        };
    }

    if (render.kind === "graph") {
        return {
            kind: "graph",
            legend: render.legend ?? [],
            nodes: render.nodes.map((node) => {
                const entry = entriesByPath.get(node.path);

                return {
                    space: node.space,
                    entryId: entry?.id,
                    routePath: entry?.routePath,
                    id: node.id,
                    kind: node.kind,
                    path: node.path,
                    title: node.title ?? entry?.title ?? node.path,
                    classification: node.classification,
                };
            }),
            edges: render.edges.map((edge) => ({
                id: edge.id,
                intent: edge.intent,
                referenceSource: edge.referenceSource,
                label: edge.label,
                fragment: edge.fragment,
                fragmentKind: edge.fragmentKind,
                field: edge.field,
                semanticType: edge.semanticType,
                source: edge.source,
                sourcePath: edge.sourcePath,
                target: edge.target,
                targetPath: edge.targetPath,
            })),
        };
    }

    // The wire may come from a newer backend than this client's type union.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (render.kind === "table") {
        return {
            kind: "table",
            columns: render.columns,
            items: render.items.map((item) => mapViewProjectionItem(item, entriesByPath)),
        };
    }
    throw new Error("Unsupported View projection. Update the client to match the backend.");
}

function mapViewProjectionItem(
    item: ViewRenderItem,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardViewProjectionItem {
    const entry = entriesByPath.get(item.path);

    return {
        entryId: entry?.id,
        routePath: entry?.routePath,
        fields: Object.fromEntries(
            Object.entries(item.fields ?? {}).map(([key, value]) => [key, formatViewField(key, value)]),
        ),
        rawFields: Object.fromEntries(
            Object.entries(item.fields ?? {}).map(([key, value]) => [key, mapViewField(value, entriesByPath)]),
        ),
        path: item.path,
        title: item.title ?? entry?.title ?? item.path,
    };
}

function mapViewField(
    value: ViewRenderFieldValue,
    entriesByPath: ReadonlyMap<string, DashboardEntry>,
): DashboardViewFieldValue {
    const mapReference = (reference: { path: string; title: string }) => ({
        ...reference,
        routePath: entriesByPath.get(reference.path)?.routePath,
    });

    if (value.kind === "reference") {
        return { kind: "reference", reference: mapReference(value.reference) };
    }
    if (value.kind === "referenceList") {
        return { kind: "referenceList", references: value.references.map(mapReference) };
    }
    return value;
}

function formatViewField(key: string, value: ViewRenderFieldValue): string {
    if (value.kind === "reference") return value.reference.title;
    if (value.kind === "referenceList") return value.references.map((reference) => reference.title).join(", ");
    const stringValue = stringifyViewField(value.value);

    if (!stringValue) {
        return stringValue;
    }

    return isDateTimeField(key, stringValue) ? formatRelativeDateTime(stringValue) : stringValue;
}

function stringifyViewField(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.map(stringifyViewField).filter(Boolean).join(", ");
    }

    return JSON.stringify(value);
}

function isDateTimeField(key: string, value: string): boolean {
    if (!/(^|[-_])(?:created|updated|modified|changed)(?:[-_]?at)?$/i.test(key)) {
        return false;
    }

    return !Number.isNaN(new Date(value).valueOf());
}

function mergeDiagnostics(...groups: (Diagnostic[] | undefined)[]): DashboardDiagnostic[] {
    const diagnostics = groups.flatMap((group) => (group ?? []).map(mapDiagnostic));
    const seen = new Set<string>();

    return diagnostics.filter((diagnostic) => {
        const key = JSON.stringify({
            actual: diagnostic.actual,
            code: diagnostic.code,
            expected: diagnostic.expected,
            location: diagnostic.location,
            message: diagnostic.message,
            path: diagnostic.path,
            severity: diagnostic.severity,
        });

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function mapDiagnostic(diagnostic: Diagnostic): DashboardDiagnostic {
    return {
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
        path: diagnostic.path,
        location: diagnostic.location,
        actual: diagnostic.actual,
        expected: diagnostic.expected,
        instancePath: diagnostic.instancePath,
        schemaPath: diagnostic.schemaPath,
        keyword: diagnostic.keyword,
    };
}

function mapStatus(status: OperationStatus): WorkspaceHealth {
    return status === "passed" ? "healthy" : status;
}

function maxHealth(left: WorkspaceHealth, right: WorkspaceHealth): WorkspaceHealth {
    if (left === "failed" || right === "failed") {
        return "failed";
    }

    if (left === "warning" || right === "warning") {
        return "warning";
    }

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
