export type WorkspaceHealth = "healthy" | "warning" | "failed";

export interface DashboardDocument {
    path: string;
    title: string;
    summary: string;
    collection: string;
    updatedLabel: string;
    status: WorkspaceHealth;
}

export interface DashboardCollection {
    id: string;
    title: string;
    description: string;
    entryCount: number;
    status: WorkspaceHealth;
}

export interface DashboardDiagnostic {
    severity: "error" | "warning" | "info";
    code: string;
    message: string;
    path?: string;
}

export interface DashboardView {
    id: string;
    title: string;
    description: string;
    kind: "table" | "kanban" | "graph" | "health";
}

export interface WorkspaceDashboard {
    workspaceName: string;
    tagline: string;
    status: WorkspaceHealth;
    collections: DashboardCollection[];
    recentDocuments: DashboardDocument[];
    diagnostics: DashboardDiagnostic[];
    views: DashboardView[];
}

export interface WorkspaceClient {
    getDashboard(): Promise<WorkspaceDashboard>;
}
