import {
    FormaRpcClient,
    type Diagnostic,
    type FileReferencesResult,
    type FileRenderResult,
    type OperationStatus,
    type ReferenceEdge,
    type ViewRenderItem,
    type ViewRenderOutput,
    type WorkspaceDashboardResult,
    type WorkspaceHealthFinding,
    type WorkspaceHealthResult,
} from "@choral-forma/shared";

import { formatRelativeDateTime } from "@/lib/date-time";
import { isExternalHref, normalizeWorkspaceHref } from "@/lib/workspace-links";
import type {
    DashboardDiagnostic,
    DashboardEntry,
    DashboardEntryBlock,
    DashboardEntryHeading,
    DashboardEntryLink,
    DashboardHealth,
    DashboardHealthFinding,
    DashboardSpace,
    DashboardView,
    DashboardViewProjection,
    DashboardViewProjectionItem,
    WorkspaceClient,
    WorkspaceDashboard,
    WorkspaceHealth,
} from "./workspace-client";

export class RpcWorkspaceClient implements WorkspaceClient {
    #dashboard: WorkspaceDashboard | undefined;
    readonly #rpc: FormaRpcClient;

    constructor(endpoint = "/rpc") {
        this.#rpc = new FormaRpcClient(endpoint);
    }

    async getDashboard(): Promise<WorkspaceDashboard> {
        const [dashboardResult, healthResult] = await Promise.all([
            this.#rpc.workspaceDashboard(),
            this.#rpc.workspaceHealth(),
        ]);
        this.#dashboard = mapWorkspaceDashboard(dashboardResult, healthResult);
        return this.#dashboard;
    }

    async getEntry(entryId: string): Promise<DashboardEntry> {
        const dashboard = this.#dashboard ?? (await this.getDashboard());
        const entry = dashboard.entries.find((item) => item.id === entryId);

        if (!entry) {
            throw new Error(`Entry not found: ${entryId}`);
        }

        const [renderResult, referencesResult] = await Promise.all([
            this.#rpc.renderFile(entry.path),
            this.#rpc.listFileReferences(entry.path),
        ]);

        return mapEntryDetail(entry, renderResult, referencesResult, dashboard.entries);
    }

    async getViewProjection(viewId: string): Promise<DashboardViewProjection> {
        const dashboard = this.#dashboard ?? (await this.getDashboard());
        const result = await this.#rpc.renderView(viewId);

        if (!result.render) {
            throw new Error(`View render output not found: ${viewId}`);
        }

        return mapViewProjection(result.render, dashboard.entries);
    }
}

function mapWorkspaceDashboard(
    result: WorkspaceDashboardResult,
    healthResult: WorkspaceHealthResult,
): WorkspaceDashboard {
    const entries = result.entries.map(mapEntry);
    const health = mapDashboardHealth(healthResult, entries);
    const diagnostics = mergeDiagnostics(result.diagnostics, healthResult.diagnostics);

    return {
        workspaceName: result.workspace.name,
        workspaceLogo: result.workspace.logo,
        tagline: "Markdown-backed workspace content.",
        status: maxHealth(mapStatus(result.status), health.status),
        spaces: result.spaces.map((space) => mapSpace(space, entries)),
        entries,
        diagnostics,
        health,
        views: result.views.map(mapView),
    };
}

function mapDashboardHealth(result: WorkspaceHealthResult, entries: DashboardEntry[]): DashboardHealth {
    return {
        status: mapStatus(result.status),
        diagnostics: (result.diagnostics ?? []).map(mapDiagnostic),
        findings: result.findings.map((finding) => mapHealthFinding(finding, entries)),
    };
}

function mapHealthFinding(finding: WorkspaceHealthFinding, entries: DashboardEntry[]): DashboardHealthFinding {
    const entry = entries.find((item) => item.path === finding.path);

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
        routePath: entry.routePath,
        rawPath: entry.rawPath,
        title: entry.title ?? entry.path,
        summary: entry.summary ?? "No summary provided.",
        space: entry.space,
        updatedAt: entry.updatedAt,
        updatedLabel: formatRelativeDateTime(entry.updatedAt),
        status: mapStatus(entry.status),
        variants: (entry.variants ?? []).map((variant) => ({
            language: variant.language,
            path: variant.path,
            routePath: variant.routePath,
            rawPath: variant.rawPath,
            kind: variant.kind,
            title: variant.title,
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
    entries: DashboardEntry[],
): DashboardEntry {
    return {
        ...entry,
        title: renderResult.file.title ?? entry.title,
        summary: entry.summary,
        space: renderResult.file.space ?? entry.space,
        status: mapStatus(renderResult.status),
        body: mapRenderedBody(renderResult, entries),
        diagnostics: mergeDiagnostics(renderResult.diagnostics, referencesResult.diagnostics),
        relations: {
            outgoing: referencesResult.outgoing.map((edge) => mapReferenceEdge(edge, "outgoing", entries)),
            backlinks: referencesResult.backlinks.map((edge) => mapReferenceEdge(edge, "backlink", entries)),
        },
    };
}

function mapRenderedBody(result: FileRenderResult, entries: DashboardEntry[]): DashboardEntryBlock[] {
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
        return [htmlToEntryBlock(result.render.html, result.render.headings ?? [], result.file.path, entries)];
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
    entries: DashboardEntry[],
): DashboardEntryBlock {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    for (const heading of document.body.querySelectorAll("h1")) {
        heading.remove();
    }

    const elements = Array.from(document.body.querySelectorAll("h2, h3"));
    for (const [index, element] of elements.entries()) {
        const heading = headings[index];
        if (heading) {
            element.id = heading.id;
        }
    }

    for (const anchor of document.body.querySelectorAll("a[href]")) {
        const href = anchor.getAttribute("href");
        if (!href || isExternalHref(href) || href.startsWith("#")) {
            continue;
        }

        const targetPath = normalizeWorkspaceHref(href, currentPath, entries);
        const targetEntry = entries.find((entry) => entry.path === targetPath.path);
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
    entries: DashboardEntry[],
): DashboardEntryLink {
    const targetPath = direction === "outgoing" ? edge.targetPath : edge.sourcePath;
    const targetTitle =
        direction === "outgoing" ? (edge.targetTitle ?? edge.targetPath) : (edge.sourceTitle ?? edge.sourcePath);
    const targetEntry = entries.find((entry) => entry.path === targetPath);

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
    return {
        id: view.id,
        title: view.title ?? view.id,
        display: view.display,
        space: view.space,
        description: view.space ? `Configured ${view.kind} view over ${view.space}.` : `Configured ${view.kind} view.`,
        kind: mapViewKind(view.kind),
    };
}

function mapViewProjection(render: ViewRenderOutput, entries: DashboardEntry[]): DashboardViewProjection {
    if (render.kind === "list") {
        return {
            kind: "list",
            items: render.items.map((item) => mapViewProjectionItem(item, entries)),
        };
    }

    if (render.kind === "kanban") {
        return {
            kind: "kanban",
            columns: render.columns.map((column) => ({
                id: column.id,
                label: column.label,
                items: column.items.map((item) => mapViewProjectionItem(item, entries)),
            })),
        };
    }

    if (render.kind === "graph") {
        return {
            kind: "graph",
            nodes: render.nodes.map((node) => {
                const entry = entries.find((entry) => entry.path === node.path);

                return {
                    space: node.space,
                    entryId: entry?.id,
                    routePath: entry?.routePath,
                    id: node.id,
                    kind: node.kind,
                    path: node.path,
                    title: node.title ?? entry?.title ?? node.path,
                };
            }),
            edges: render.edges.map((edge) => ({
                id: edge.id,
                intent: edge.intent,
                referenceSource: edge.referenceSource,
                label: edge.label,
                field: edge.field,
                semanticType: edge.semanticType,
                source: edge.source,
                sourcePath: edge.sourcePath,
                target: edge.target,
                targetPath: edge.targetPath,
            })),
        };
    }

    return {
        kind: "table",
        columns: render.columns,
        items: render.items.map((item) => mapViewProjectionItem(item, entries)),
    };
}

function mapViewProjectionItem(item: ViewRenderItem, entries: DashboardEntry[]): DashboardViewProjectionItem {
    const entry = entries.find((entry) => entry.path === item.path);

    return {
        entryId: entry?.id,
        routePath: entry?.routePath,
        fields: Object.fromEntries(
            Object.entries(item.fields ?? {}).map(([key, value]) => [key, formatViewField(key, value)]),
        ),
        path: item.path,
        title: item.title ?? entry?.title ?? item.path,
    };
}

function formatViewField(key: string, value: unknown): string {
    const stringValue = stringifyViewField(value);

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
    return kind === "table" || kind === "kanban" || kind === "graph" || kind === "list" ? kind : "list";
}

function latestUpdatedAt(entries: DashboardEntry[]): string | undefined {
    return entries
        .map((entry) => entry.updatedAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).valueOf() - new Date(left).valueOf())[0];
}
