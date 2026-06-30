export type WorkspaceHealth = "healthy" | "warning" | "failed";

export interface DashboardEntry {
    id: string;
    kind?: string;
    path: string;
    routePath: string;
    rawPath: string;
    title: string;
    summary: string;
    space: string;
    updatedAt?: string;
    updatedLabel: string;
    status: WorkspaceHealth;
    body: DashboardEntryBlock[];
    diagnostics?: DashboardDiagnostic[];
    relations: DashboardEntryRelations;
    variants: DashboardEntryVariant[];
}

export interface DashboardEntryVariant {
    language: string;
    path: string;
    routePath: string;
    rawPath: string;
    kind?: string;
    title?: string;
    summary?: string;
}

export type DashboardEntryBlock =
    | {
          type: "markdown";
          markdown: string;
          outline: DashboardEntryHeading[];
      }
    | {
          type: "html";
          html: string;
          outline: DashboardEntryHeading[];
      }
    | {
          type: "heading";
          level: 2 | 3;
          text: string;
      }
    | {
          type: "paragraph";
          text: string;
      }
    | {
          type: "list";
          items: string[];
      }
    | {
          type: "quote";
          text: string;
      }
    | {
          type: "code";
          language: string;
          code: string;
      }
    | {
          type: "table";
          columns: string[];
          rows: string[][];
      };

export interface DashboardEntryHeading {
    id: string;
    level: 2 | 3;
    text: string;
}

export interface DashboardEntryLink {
    kind: "external" | "internal" | "unresolved";
    label: string;
    targetEntryId?: string;
    targetRoutePath?: string;
    targetPath: string;
}

export interface DashboardEntryRelations {
    outgoing: DashboardEntryLink[];
    backlinks: DashboardEntryLink[];
}

export interface DashboardSpace {
    id: string;
    title: string;
    display?: DisplayOptions;
    description: string;
    entryCount: number;
    path: string;
    status: WorkspaceHealth;
    updatedAt?: string;
    updatedLabel: string;
}

export interface DashboardDiagnostic {
    severity: "error" | "warning" | "info";
    code: string;
    message: string;
    path?: string;
    location?: {
        column?: number;
        field?: string;
        index?: number;
        kind: "body" | "config" | "file" | "frontmatter";
        line?: number;
    };
    actual?: unknown;
    expected?: unknown;
}

export type DashboardHealthCategory =
    "brokenReference" | "ambiguousReference" | "noOutgoingReferences" | "noBacklinks" | "configDiagnostic";

export interface DashboardHealthFinding {
    category: DashboardHealthCategory;
    severity: "error" | "warning" | "info";
    path: string;
    message: string;
    target?: string;
    routePath?: string;
    title?: string;
}

export interface DashboardHealth {
    status: WorkspaceHealth;
    diagnostics: DashboardDiagnostic[];
    findings: DashboardHealthFinding[];
}

export interface DashboardView {
    id: string;
    title: string;
    display?: DisplayOptions;
    description: string;
    kind: "list" | "table" | "kanban" | "graph";
    space?: string;
}

export interface DisplayOptions {
    order?: number;
}

export interface DashboardViewProjectionItem {
    entryId?: string;
    routePath?: string;
    fields: Record<string, string>;
    path: string;
    title: string;
}

export interface DashboardGraphNode {
    space: string;
    entryId?: string;
    routePath?: string;
    id: string;
    kind?: string;
    path: string;
    title: string;
}

export interface DashboardGraphEdge {
    id: string;
    intent: "reference" | "link" | "embed";
    referenceSource: "frontmatter" | "body";
    label: string;
    field?: string;
    semanticType?: string;
    source: string;
    sourcePath: string;
    target: string;
    targetPath: string;
}

export interface DashboardViewColumn {
    field: string;
    label: string;
}

export type DashboardViewProjection =
    | {
          kind: "list";
          items: DashboardViewProjectionItem[];
      }
    | {
          kind: "table";
          columns: DashboardViewColumn[];
          items: DashboardViewProjectionItem[];
      }
    | {
          kind: "kanban";
          columns: {
              id: string;
              items: DashboardViewProjectionItem[];
              label: string;
          }[];
      }
    | {
          kind: "graph";
          edges: DashboardGraphEdge[];
          nodes: DashboardGraphNode[];
      };

export interface WorkspaceDashboard {
    workspaceName: string;
    workspaceLogo?: {
        url: string;
        alt: string;
    };
    tagline: string;
    status: WorkspaceHealth;
    spaces: DashboardSpace[];
    entries: DashboardEntry[];
    diagnostics: DashboardDiagnostic[];
    health: DashboardHealth;
    views: DashboardView[];
}

export interface WorkspaceClient {
    getDashboard(): Promise<WorkspaceDashboard>;
    getEntry(entryId: string): Promise<DashboardEntry>;
    getViewProjection(viewId: string): Promise<DashboardViewProjection>;
}
