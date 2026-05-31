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
} from "@choral-forma/shared";

import { formatRelativeDateTime } from "@/lib/date-time";
import type {
    DashboardDiagnostic,
    DashboardDocument,
    DashboardDocumentBlock,
    DashboardDocumentHeading,
    DashboardDocumentLink,
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
        this.#dashboard = mapWorkspaceDashboard(await this.#rpc.workspaceDashboard());
        return this.#dashboard;
    }

    async getDocument(documentId: string): Promise<DashboardDocument> {
        const dashboard = this.#dashboard ?? (await this.getDashboard());
        const document = dashboard.documents.find((item) => item.id === documentId);

        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }

        const [renderResult, referencesResult] = await Promise.all([
            this.#rpc.renderFile(document.path, "html"),
            this.#rpc.listFileReferences(document.path),
        ]);

        return mapDocumentDetail(document, renderResult, referencesResult, dashboard.documents);
    }

    async getViewProjection(viewId: string): Promise<DashboardViewProjection> {
        const dashboard = this.#dashboard ?? (await this.getDashboard());
        const result = await this.#rpc.renderView(viewId);

        if (!result.render) {
            throw new Error(`View render output not found: ${viewId}`);
        }

        return mapViewProjection(result.render, dashboard.documents);
    }
}

function mapWorkspaceDashboard(result: WorkspaceDashboardResult): WorkspaceDashboard {
    const documents = result.documents.map(mapDocument);

    return {
        workspaceName: result.workspace.name,
        tagline: "Repository-backed workspace knowledge.",
        status: mapStatus(result.status),
        spaces: result.spaces.map((space) => mapSpace(space, documents)),
        documents,
        diagnostics: (result.diagnostics ?? []).map(mapDiagnostic),
        views: result.views.map(mapView),
    };
}

function mapSpace(space: WorkspaceDashboardResult["spaces"][number], documents: DashboardDocument[]): DashboardSpace {
    const updatedAt = latestUpdatedAt(documents.filter((document) => document.space === space.id));

    return {
        id: space.id,
        title: space.title,
        description: `Entries matched by ${space.include}.`,
        entryCount: space.entryCount,
        path: space.include,
        status: mapStatus(space.status),
        updatedAt,
        updatedLabel: formatRelativeDateTime(updatedAt),
    };
}

function mapDocument(document: WorkspaceDashboardResult["documents"][number]): DashboardDocument {
    return {
        id: document.id,
        kind: document.kind,
        path: document.path,
        title: document.title ?? document.path,
        summary: document.summary ?? "No summary provided.",
        space: document.space,
        updatedAt: document.updatedAt,
        updatedLabel: formatRelativeDateTime(document.updatedAt),
        status: mapStatus(document.status),
        body: [
            {
                type: "paragraph",
                text:
                    document.summary ??
                    "Document rendering will be loaded from file.render in the next backend wiring step.",
            },
        ],
        diagnostics: [],
        relations: {
            outgoing: [],
            backlinks: [],
        },
    };
}

function mapDocumentDetail(
    document: DashboardDocument,
    renderResult: FileRenderResult,
    referencesResult: FileReferencesResult,
    documents: DashboardDocument[],
): DashboardDocument {
    return {
        ...document,
        title: renderResult.file.title ?? document.title,
        summary: document.summary,
        space: renderResult.file.space ?? document.space,
        status: mapStatus(renderResult.status),
        body: mapRenderedBody(renderResult, documents),
        diagnostics: mergeDiagnostics(renderResult.diagnostics, referencesResult.diagnostics),
        relations: {
            outgoing: referencesResult.outgoing.map((edge) => mapReferenceEdge(edge, "outgoing", documents)),
            backlinks: referencesResult.backlinks.map((edge) => mapReferenceEdge(edge, "backlink", documents)),
        },
    };
}

function mapRenderedBody(result: FileRenderResult, documents: DashboardDocument[]): DashboardDocumentBlock[] {
    if (result.render.html) {
        return [htmlToDocumentBlock(result.render.html, result.render.headings ?? [], result.file.path, documents)];
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
            text: "No renderable document body was returned by file.render.",
        },
    ];
}

function htmlToDocumentBlock(
    html: string,
    headings: DashboardDocumentHeading[],
    currentPath: string,
    documents: DashboardDocument[],
): DashboardDocumentBlock {
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

        const targetPath = normalizeWorkspaceHref(href, currentPath, documents);
        const targetDocument = documents.find((document) => document.path === targetPath.path);
        if (targetDocument) {
            anchor.setAttribute("href", `/documents/${targetDocument.id}${targetPath.hash}`);
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
    documents: DashboardDocument[],
): DashboardDocumentLink {
    const targetPath = direction === "outgoing" ? edge.targetPath : edge.sourcePath;
    const targetTitle =
        direction === "outgoing" ? (edge.targetTitle ?? edge.targetPath) : (edge.sourceTitle ?? edge.sourcePath);
    const targetDocument = documents.find((document) => document.path === targetPath);

    return {
        kind: mapReferenceKind(edge, targetDocument),
        label: targetTitle,
        targetDocumentId: targetDocument?.id,
        targetPath,
    };
}

function mapReferenceKind(
    edge: ReferenceEdge,
    targetDocument: DashboardDocument | undefined,
): DashboardDocumentLink["kind"] {
    if (targetDocument) {
        return "internal";
    }

    return edge.targetPath.includes("://") ? "external" : "unresolved";
}

function mapView(view: WorkspaceDashboardResult["views"][number]): DashboardView {
    return {
        id: view.id,
        title: view.title ?? view.id,
        space: view.space,
        description: view.space ? `Configured ${view.kind} view over ${view.space}.` : `Configured ${view.kind} view.`,
        kind: mapViewKind(view.kind),
    };
}

function mapViewProjection(render: ViewRenderOutput, documents: DashboardDocument[]): DashboardViewProjection {
    if (render.kind === "list") {
        return {
            kind: "list",
            items: render.items.map((item) => mapViewProjectionItem(item, documents)),
        };
    }

    if (render.kind === "kanban") {
        return {
            kind: "kanban",
            columns: render.columns.map((column) => ({
                id: column.id,
                label: column.label,
                items: column.items.map((item) => mapViewProjectionItem(item, documents)),
            })),
        };
    }

    if (render.kind === "graph") {
        return {
            kind: "graph",
            nodes: render.nodes.map((node) => {
                const document = documents.find((document) => document.path === node.path);

                return {
                    space: node.space,
                    documentId: document?.id,
                    id: node.id,
                    kind: node.kind,
                    path: node.path,
                    title: node.title ?? document?.title ?? node.path,
                };
            }),
            edges: render.edges.map((edge) => ({
                id: edge.id,
                intent: edge.intent,
                referenceSource: edge.referenceSource,
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
        items: render.items.map((item) => mapViewProjectionItem(item, documents)),
    };
}

function mapViewProjectionItem(item: ViewRenderItem, documents: DashboardDocument[]): DashboardViewProjectionItem {
    const document = documents.find((document) => document.path === item.path);

    return {
        documentId: document?.id,
        fields: Object.fromEntries(
            Object.entries(item.fields ?? {}).map(([key, value]) => [key, formatViewField(key, value)]),
        ),
        path: item.path,
        title: item.title ?? document?.title ?? item.path,
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

function mapViewKind(kind: string): DashboardView["kind"] {
    return kind === "table" || kind === "kanban" || kind === "graph" || kind === "list" ? kind : "list";
}

function latestUpdatedAt(documents: DashboardDocument[]): string | undefined {
    return documents
        .map((document) => document.updatedAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).valueOf() - new Date(left).valueOf())[0];
}

function isExternalHref(href: string) {
    return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function normalizeWorkspaceHref(href: string, currentPath: string, documents: DashboardDocument[]) {
    const [pathPart = "", hashPart] = href.split("#", 2);
    const hash = hashPart ? `#${hashPart}` : "";
    const directPath = pathPart.replace(/^\.\//, "").replace(/^\//, "");

    if (documents.some((document) => document.path === directPath)) {
        return {
            hash,
            path: directPath,
        };
    }

    const pathSegments = pathPart.startsWith("/") ? [] : currentPath.split("/").slice(0, -1);

    for (const segment of pathPart.split("/")) {
        if (!segment || segment === ".") {
            continue;
        }

        if (segment === "..") {
            pathSegments.pop();
            continue;
        }

        pathSegments.push(segment);
    }

    return {
        hash,
        path: pathSegments.join("/"),
    };
}
