export type WorkspaceHealth = "healthy" | "warning" | "failed";

export interface DashboardDocument {
    id: string;
    kind?: string;
    path: string;
    title: string;
    summary: string;
    space: string;
    updatedAt?: string;
    updatedLabel: string;
    status: WorkspaceHealth;
    body: DashboardDocumentBlock[];
    diagnostics?: DashboardDiagnostic[];
    relations: DashboardDocumentRelations;
}

export type DashboardDocumentBlock =
    | {
          type: "html";
          html: string;
          outline: DashboardDocumentHeading[];
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

export interface DashboardDocumentHeading {
    id: string;
    level: 2 | 3;
    text: string;
}

export interface DashboardDocumentLink {
    kind: "external" | "internal" | "unresolved";
    label: string;
    targetDocumentId?: string;
    targetPath: string;
}

export interface DashboardDocumentRelations {
    outgoing: DashboardDocumentLink[];
    backlinks: DashboardDocumentLink[];
}

export interface DashboardSpace {
    id: string;
    title: string;
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

export interface DashboardView {
    id: string;
    title: string;
    description: string;
    kind: "list" | "table" | "kanban" | "graph";
    space?: string;
}

export interface DashboardViewProjectionItem {
    documentId?: string;
    fields: Record<string, string>;
    path: string;
    title: string;
}

export interface DashboardGraphNode {
    space: string;
    documentId?: string;
    id: string;
    kind?: string;
    path: string;
    title: string;
}

export interface DashboardGraphEdge {
    id: string;
    intent: "reference" | "link" | "embed";
    referenceSource: "frontmatter" | "body";
    source: string;
    sourcePath: string;
    target: string;
    targetPath: string;
}

export type DashboardViewProjection =
    | {
          kind: "list";
          items: DashboardViewProjectionItem[];
      }
    | {
          kind: "table";
          columns: string[];
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
    tagline: string;
    status: WorkspaceHealth;
    spaces: DashboardSpace[];
    documents: DashboardDocument[];
    diagnostics: DashboardDiagnostic[];
    views: DashboardView[];
}

export interface WorkspaceClient {
    getDashboard(): Promise<WorkspaceDashboard>;
    getDocument(documentId: string): Promise<DashboardDocument>;
    getViewProjection(viewId: string): Promise<DashboardViewProjection>;
}
