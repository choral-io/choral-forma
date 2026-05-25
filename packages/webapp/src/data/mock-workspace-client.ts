import type { WorkspaceClient, WorkspaceDashboard } from "./workspace-client";

const dashboard: WorkspaceDashboard = {
    workspaceName: "Forma Internal Knowledge",
    tagline: "Repository-backed product knowledge for the Choral Forma team.",
    status: "warning",
    collections: [
        {
            id: "decisions",
            title: "Decisions",
            description: "Accepted product and technical tradeoffs.",
            entryCount: 14,
            status: "healthy",
        },
        {
            id: "tasks",
            title: "Tasks",
            description: "Delivery candidates, accepted work, and review gates.",
            entryCount: 32,
            status: "warning",
        },
        {
            id: "architecture",
            title: "Architecture",
            description: "Core modules, RPC contracts, and package boundaries.",
            entryCount: 8,
            status: "healthy",
        },
        {
            id: "design",
            title: "Design",
            description: "Dashboard, interaction, and product surface guidance.",
            entryCount: 5,
            status: "healthy",
        },
    ],
    recentDocuments: [
        {
            path: "decisions/webapp-primary-gui-client.md",
            title: "WebApp Primary GUI Client",
            summary: "WebApp is the primary GUI surface for P1 product work.",
            collection: "decisions",
            updatedLabel: "Today",
            status: "healthy",
        },
        {
            path: "design/webapp-v2-dashboard-design.md",
            title: "WebApp V2 Dashboard Design",
            summary: "Notion-like dashboard direction for the V2 WebApp shell.",
            collection: "design",
            updatedLabel: "Today",
            status: "healthy",
        },
        {
            path: "tasks/implement-webapp-v2-dashboard-shell.md",
            title: "Implement WebApp V2 Dashboard Shell",
            summary: "Fake-data shell with WebApp-local Tailwind, shadcn/ui, and Base UI.",
            collection: "tasks",
            updatedLabel: "This week",
            status: "warning",
        },
    ],
    diagnostics: [
        {
            severity: "warning",
            code: "proposal-gate",
            message: "Write-adjacent actions require the reviewable operation proposal model.",
        },
        {
            severity: "info",
            code: "mock-data",
            message: "The dashboard is currently using deterministic fake workspace data.",
        },
    ],
    views: [
        {
            id: "active-work",
            title: "Active Work",
            description: "Accepted work grouped by delivery state.",
            kind: "kanban",
        },
        {
            id: "knowledge-health",
            title: "Knowledge Health",
            description: "Diagnostics grouped by severity and affected path.",
            kind: "health",
        },
        {
            id: "workspace-graph",
            title: "Workspace Graph",
            description: "Reference graph placeholder for indexed knowledge.",
            kind: "graph",
        },
    ],
};

export const mockWorkspaceClient: WorkspaceClient = {
    getDashboard() {
        return Promise.resolve(dashboard);
    },
};
