export const schemaVersion = 1 as const;

export type OperationStatus = "passed" | "warning" | "failed";

export type DiagnosticSeverity = "error" | "warning" | "info";

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
  actual?: unknown;
  expected?: unknown;
  suggestions?: Array<{ label: string; value: unknown }>;
};

export type WorkspaceSummary = {
  root: string;
  name: string;
};

export type BaseOperationResult = {
  schemaVersion: typeof schemaVersion;
  operation: string;
  status: OperationStatus;
  workspace?: WorkspaceSummary;
  summary?: DiagnosticSummary;
  diagnostics?: Diagnostic[];
};

export type IndexCollection = {
  id: string;
  title: string;
  include: string;
  entryCount: number;
};

export type IndexView = {
  id: string;
  path: string;
  surface: string;
  mode: string;
  collection?: string;
  title?: string;
  source?: {
    kind: string;
    include?: string[];
    exclude?: string[];
  };
};

export type ListedEntry = {
  path: string;
  kind?: string;
  title?: string;
  summary?: string;
  fields?: Record<string, unknown>;
};

export type ListedCollection = {
  id: string;
  title: string;
  include: string;
  entryCount: number;
};

export type ListedFile = {
  path: string;
  kind: "entry" | "view" | "markdown" | "config" | "index";
  collection?: string;
  title?: string;
};

export type InspectEntry = {
  path: string;
  collection: string;
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
  semanticType?: string;
  intent: "reference" | "link" | "embed";
};

export type RenderedEntry = {
  path: string;
  collection: string;
  kind?: string;
  title?: string;
};

export type EntryRenderOutput = {
  format: string;
  html: string;
  refs: IndexReference[];
};

export type RenderedView = {
  id: string;
  path: string;
  surface: string;
  mode: string;
  title?: string;
  collection?: string;
  source?: {
    kind: string;
    include?: string[];
    exclude?: string[];
  };
  params?: Record<string, unknown>;
};

export type ViewRenderItem = {
  path: string;
  title?: string;
  fields?: Record<string, unknown>;
};

export type ViewRenderOutput =
  | {
      kind: "table";
      columns: string[];
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
    };

export type CheckResult = BaseOperationResult & {
  operation: "check" | "index.check";
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
    collections?: Record<string, unknown>;
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
  files: ListedFile[];
};

export type ListResult = BaseOperationResult & {
  operation: "list";
  workspace: WorkspaceSummary;
  collection: ListedCollection;
  entries: ListedEntry[];
};

export type InspectResult = BaseOperationResult & {
  operation: "inspect";
  workspace: WorkspaceSummary;
  entry: InspectEntry;
};

export type EntryRenderResult = BaseOperationResult & {
  operation: "entry.render";
  workspace: WorkspaceSummary;
  entry: RenderedEntry;
  render: EntryRenderOutput;
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
    this.fetcher = fetcher ?? ((input, init) => globalFetch!(input, init));
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
      throw new Error(`RPC transport failed with HTTP ${response.status}`);
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

  indexCheck() {
    return this.call<CheckResult>("index.check");
  }

  configInspect() {
    return this.call<ConfigInspectResult>("config.inspect");
  }

  filesList() {
    return this.call<FilesListResult>("files.list");
  }

  list(collection: string) {
    return this.call<ListResult>("list", { collection });
  }

  inspect(path: string) {
    return this.call<InspectResult>("inspect", { path });
  }

  renderEntry(path: string) {
    return this.call<EntryRenderResult>("entry.render", { path, format: "html" });
  }

  renderView(view: string) {
    return this.call<ViewRenderResult>("view.render", { view });
  }
}
