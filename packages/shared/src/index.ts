export const schemaVersion = 1 as const;

export type OperationStatus = "passed" | "warning" | "failed";

export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticLocation =
    | {
          kind: "file";
      }
    | {
          field: string;
          index?: number;
          kind: "frontmatter";
      }
    | {
          column?: number;
          kind: "body";
          line?: number;
      }
    | {
          field: string;
          kind: "config";
      };

export type DiagnosticSummary = {
    errors: number;
    warnings: number;
    infos: number;
};

export type Diagnostic = {
    severity: DiagnosticSeverity;
    code: string;
    message: string;
    path?: string;
    location?: DiagnosticLocation;
    actual?: unknown;
    expected?: unknown;
    suggestions?: Array<{ label: string; value: unknown }>;
};

export type WorkspaceSummary = {
    root: string;
    name: string;
    logo?: {
        url: string;
        alt: string;
    };
};

export type BaseOperationResult = {
    schemaVersion: typeof schemaVersion;
    operation: string;
    status: OperationStatus;
    workspace?: WorkspaceSummary;
    summary?: DiagnosticSummary;
    diagnostics?: Diagnostic[];
};

export type IndexSpace = {
    id: string;
    title: string;
    display?: DisplayOptions;
    include: string;
    includePatterns: string[];
    entryCount: number;
};

export type IndexView = {
    id: string;
    path: string;
    surface: string;
    mode: string;
    space?: string;
    title?: string;
    source?: {
        type: string;
        include?: string[];
        exclude?: string[];
        taxonomy?: Record<string, string[]>;
    };
    display?: DisplayOptions;
};

export type DisplayOptions = {
    order?: number;
};

export type ListedEntry = {
    path: string;
    kind?: string;
    title?: string;
    summary?: string;
    fields?: Record<string, unknown>;
};

export type ListedSpace = {
    id: string;
    title: string;
    include: string;
    includePatterns: string[];
    entryCount: number;
};

export type WorkspaceFileKind = "knowledge" | "view" | "template" | "markdown" | "config" | "resource";

export type WorkspaceFileFeature = "render.markdown" | "render.source" | "render.view" | "preview.media";

export type WorkspaceFile = {
    path: string;
    name: string;
    parent: string;
    depth: number;
    kind: WorkspaceFileKind;
    mediaType: string;
    features: WorkspaceFileFeature[];
    space?: string;
    title?: string;
    frontmatter?: Record<string, unknown>;
};

export type ListedFile = WorkspaceFile;

export type InspectEntry = {
    path: string;
    space: string;
    kind?: string;
    title?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    headings?: string[];
    refs?: IndexReference[];
    renderable: boolean;
};

export type IndexReference = {
    source: "frontmatter" | "body";
    field?: string;
    targetPath: string;
    fragment?: string;
    fragmentKind?: "heading" | "block";
    targetTitle?: string;
    semanticType?: string;
    intent: "reference" | "link" | "embed";
};

export type RenderedFile = {
    path: string;
    space?: string;
    kind?: string;
    title?: string;
};

export type FileRenderOutput = {
    format: string;
    markdown?: string;
    html?: string;
    headings?: Array<{
        id: string;
        level: 2 | 3;
        text: string;
    }>;
    source?: string;
    refs: IndexReference[];
};

export type ReferenceFile = {
    path: string;
    space: string;
    kind?: string;
    title?: string;
};

export type ReferenceEdge = {
    sourcePath: string;
    sourceTitle?: string;
    sourceKind?: string;
    targetPath: string;
    fragment?: string;
    fragmentKind?: "heading" | "block";
    targetTitle?: string;
    targetKind?: string;
    source: "frontmatter" | "body";
    field?: string;
    semanticType?: string;
    intent: "reference" | "link" | "embed";
};

export type RenderedView = {
    id: string;
    path: string;
    surface: string;
    mode: string;
    title?: string;
    space?: string;
    source?: {
        type: string;
        include?: string[];
        exclude?: string[];
        taxonomy?: Record<string, string[]>;
    };
    params?: Record<string, unknown>;
};

export type ViewRenderItem = {
    path: string;
    title?: string;
    fields?: Record<string, unknown>;
};

export type ViewRenderColumn = {
    field: string;
    label: string;
};

export type GraphRenderNode = {
    id: string;
    path: string;
    title?: string;
    space: string;
    kind?: string;
};

export type GraphRenderEdge = {
    id: string;
    source: string;
    target: string;
    sourcePath: string;
    targetPath: string;
    fragment?: string;
    fragmentKind?: "heading" | "block";
    intent: "reference" | "link" | "embed";
    referenceSource: "frontmatter" | "body";
    label: string;
    field?: string;
    semanticType?: string;
};

export type ViewRenderOutput =
    | {
          kind: "list";
          items: ViewRenderItem[];
      }
    | {
          kind: "table";
          columns: ViewRenderColumn[];
          items: ViewRenderItem[];
      }
    | {
          kind: "kanban";
          columns: Array<{
              id: string;
              label: string;
              icon?: string;
              items: ViewRenderItem[];
          }>;
      }
    | {
          kind: "graph";
          nodes: GraphRenderNode[];
          edges: GraphRenderEdge[];
      };

export type CheckResult = BaseOperationResult & {
    operation: "check";
};

export type ConfigInspectResult = BaseOperationResult & {
    operation: "config.inspect";
    workspace: WorkspaceSummary;
    config: {
        workspace?: {
            name?: string;
            canonicalLanguage?: string;
            supportedLanguages?: string[];
            timezone?: string;
        };
        dashboard?: Record<string, unknown>;
        spaces?: Record<string, unknown>;
        taxonomies?: Record<string, unknown>;
        runtime?: Record<string, unknown>;
        types?: Record<string, unknown>;
    };
    sources: Array<{
        path: string;
        kind: "shared" | "local";
        present: boolean;
    }>;
};

export type FilesListResult = BaseOperationResult & {
    operation: "files.list";
    workspace: WorkspaceSummary;
    files: WorkspaceFile[];
};

export type DashboardSpace = {
    id: string;
    title: string;
    display?: DisplayOptions;
    include: string;
    includePatterns: string[];
    entryCount: number;
    status: OperationStatus;
};

export type DashboardEntrySummary = {
    id: string;
    path: string;
    routePath: string;
    rawPath: string;
    space: string;
    kind?: string;
    title?: string;
    summary?: string;
    variants?: DashboardEntryVariant[];
    status: OperationStatus;
    updatedAt?: string;
    renderable: boolean;
};

export type DashboardEntryVariant = {
    language: string;
    path: string;
    routePath: string;
    rawPath: string;
    kind?: string;
    title?: string;
    summary?: string;
};

export type DashboardViewSummary = {
    id: string;
    path: string;
    kind: string;
    title?: string;
    display?: DisplayOptions;
    space?: string;
};

export type WorkspaceDashboardResult = BaseOperationResult & {
    operation: "workspace.dashboard";
    workspace: WorkspaceSummary;
    spaces: DashboardSpace[];
    entries: DashboardEntrySummary[];
    views: DashboardViewSummary[];
};

export type ListResult = BaseOperationResult & {
    operation: "list";
    workspace: WorkspaceSummary;
    space: ListedSpace;
    entries: ListedEntry[];
};

export type InspectResult = BaseOperationResult & {
    operation: "inspect";
    workspace: WorkspaceSummary;
    entry: InspectEntry;
};

export type FileRenderResult = BaseOperationResult & {
    operation: "file.render";
    workspace: WorkspaceSummary;
    file: RenderedFile;
    render: FileRenderOutput;
};

export type FileReferencesResult = BaseOperationResult & {
    operation: "file.references";
    workspace: WorkspaceSummary;
    file: ReferenceFile;
    outgoing: ReferenceEdge[];
    backlinks: ReferenceEdge[];
};

export type ViewRenderResult = BaseOperationResult & {
    operation: "view.render";
    workspace: WorkspaceSummary;
    view?: RenderedView;
    render?: ViewRenderOutput;
};

export type JsonRpcSuccess<T> = {
    jsonrpc: "2.0";
    id: string | number;
    result: T;
};

export type JsonRpcFailure = {
    jsonrpc: "2.0";
    id: string | number | null;
    error: {
        code: number;
        message: string;
        data?: {
            code?: string;
            details?: unknown[];
        };
    };
};

export class FormaRpcError extends Error {
    readonly code: number;
    readonly dataCode: string | undefined;

    constructor(error: JsonRpcFailure["error"]) {
        super(error.message);
        this.name = "FormaRpcError";
        this.code = error.code;
        this.dataCode = error.data?.code;
    }
}

type RpcFetch = (
    input: string,
    init: {
        method: string;
        headers: Record<string, string>;
        body: string;
    },
) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;

export class FormaRpcClient {
    private nextId = 1;
    private readonly endpoint: string;
    private readonly fetcher: RpcFetch;

    constructor(endpoint = "/rpc", fetcher?: RpcFetch) {
        this.endpoint = endpoint;
        const globalFetch = (globalThis as unknown as { fetch?: RpcFetch }).fetch;
        if (!fetcher && !globalFetch) {
            throw new Error("FormaRpcClient requires a fetch implementation.");
        }
        this.fetcher =
            fetcher ??
            ((input, init) => {
                if (!globalFetch) {
                    throw new Error("FormaRpcClient requires a fetch implementation.");
                }
                return globalFetch(input, init);
            });
    }

    async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
        const id = String(this.nextId++);
        const response = await this.fetcher(this.endpoint, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id,
                method,
                params,
            }),
        });

        if (!response.ok) {
            throw new Error(`RPC transport failed with HTTP ${String(response.status)}`);
        }

        const body = (await response.json()) as JsonRpcSuccess<T> | JsonRpcFailure;
        if ("error" in body) {
            throw new FormaRpcError(body.error);
        }
        return body.result;
    }

    check() {
        return this.call<CheckResult>("check");
    }

    configInspect() {
        return this.call<ConfigInspectResult>("config.inspect");
    }

    filesList() {
        return this.call<FilesListResult>("files.list");
    }

    workspaceDashboard() {
        return this.call<WorkspaceDashboardResult>("workspace.dashboard");
    }

    list(space: string) {
        return this.call<ListResult>("list", { space });
    }

    inspect(path: string) {
        return this.call<InspectResult>("inspect", { path });
    }

    renderFile(path: string, format: "markdown" | "html" | "source" = "markdown") {
        return this.call<FileRenderResult>("file.render", { path, format });
    }

    listFileReferences(path: string) {
        return this.call<FileReferencesResult>("file.references", { path });
    }

    renderView(view: string) {
        return this.call<ViewRenderResult>("view.render", { view });
    }
}
