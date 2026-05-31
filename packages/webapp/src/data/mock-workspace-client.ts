import type { DashboardViewProjection, WorkspaceClient, WorkspaceDashboard } from "./workspace-client";

import { formatRelativeDateTime } from "@/lib/date-time";

const recentMockUpdatedAt = "2026-05-29T09:45:21.155230013Z";
const weeklyMockUpdatedAt = "2026-05-23T07:22:23.794591623Z";

const dashboard: WorkspaceDashboard = {
    workspaceName: "Forma Internal Knowledge",
    tagline: "Repository-backed product knowledge for the Choral Forma team.",
    status: "warning",
    spaces: [
        {
            id: "decisions",
            title: "Decisions",
            description: "Accepted product and technical tradeoffs.",
            entryCount: 14,
            path: "knowledge/decisions",
            status: "healthy",
            updatedAt: recentMockUpdatedAt,
            updatedLabel: formatRelativeDateTime(recentMockUpdatedAt),
        },
        {
            id: "tasks",
            title: "Tasks",
            description: "Delivery candidates, accepted work, and review gates.",
            entryCount: 32,
            path: "knowledge/tasks",
            status: "warning",
            updatedAt: recentMockUpdatedAt,
            updatedLabel: formatRelativeDateTime(recentMockUpdatedAt),
        },
        {
            id: "architecture",
            title: "Architecture",
            description: "Core modules, RPC contracts, and package boundaries.",
            entryCount: 8,
            path: "knowledge/architecture",
            status: "healthy",
            updatedAt: weeklyMockUpdatedAt,
            updatedLabel: formatRelativeDateTime(weeklyMockUpdatedAt),
        },
        {
            id: "design",
            title: "Design",
            description: "Dashboard, interaction, and product surface guidance.",
            entryCount: 5,
            path: "knowledge/design",
            status: "healthy",
            updatedAt: recentMockUpdatedAt,
            updatedLabel: formatRelativeDateTime(recentMockUpdatedAt),
        },
    ],
    documents: [
        {
            id: "webapp-primary-gui-client",
            path: "decisions/webapp-primary-gui-client.md",
            title: "WebApp Primary GUI Client",
            summary: "WebApp is the primary GUI surface for P1 product work.",
            space: "decisions",
            updatedAt: recentMockUpdatedAt,
            updatedLabel: formatRelativeDateTime(recentMockUpdatedAt),
            status: "healthy",
            body: [
                {
                    type: "paragraph",
                    text: "The WebApp is the primary GUI client for browsing Choral Forma knowledge when editor integration is unavailable or not in use.",
                },
                {
                    type: "heading",
                    level: 2,
                    text: "Decision",
                },
                {
                    type: "paragraph",
                    text: "The product should prioritize a repository-backed knowledge reader over an embedded editing or Agent surface.",
                },
                {
                    type: "list",
                    items: [
                        "Repository Markdown remains the source of truth.",
                        "Write-adjacent actions must be routed through explicit operations in later versions.",
                        "Editor extensions can provide richer authoring and Agent handoff later.",
                    ],
                },
            ],
            relations: {
                outgoing: [
                    {
                        kind: "internal",
                        label: "WebApp V2 Dashboard Design",
                        targetDocumentId: "webapp-v2-dashboard-design",
                        targetPath: "design/webapp-v2-dashboard-design.md",
                    },
                ],
                backlinks: [
                    {
                        kind: "internal",
                        label: "Implement WebApp V2 Dashboard Shell",
                        targetDocumentId: "implement-webapp-v2-dashboard-shell",
                        targetPath: "tasks/implement-webapp-v2-dashboard-shell.md",
                    },
                ],
            },
        },
        {
            id: "webapp-v2-dashboard-design",
            path: "design/webapp-v2-dashboard-design.md",
            title: "WebApp V2 Dashboard Design",
            summary: "Notion-like dashboard direction for the V2 WebApp shell.",
            space: "design",
            updatedAt: recentMockUpdatedAt,
            updatedLabel: formatRelativeDateTime(recentMockUpdatedAt),
            status: "healthy",
            body: [
                {
                    type: "paragraph",
                    text: "The V2 dashboard design treats Forma as a calm knowledge reader with a stable shell, clear route context, and lightweight navigation.",
                },
                {
                    type: "heading",
                    level: 2,
                    text: "Layout Direction",
                },
                {
                    type: "paragraph",
                    text: "The main shell uses a collapsible workspace sidebar, a route header, a document-centered content column, and an optional route context panel.",
                },
                {
                    type: "quote",
                    text: "Prefer explicit repository-backed knowledge surfaces over hidden application state.",
                },
                {
                    type: "table",
                    columns: ["Surface", "Role", "Status"],
                    rows: [
                        ["Spaces", "Knowledge partitions", "Designed"],
                        ["Documents", "Global document index", "Designed"],
                        ["Views", "Saved projections", "Pending renderer"],
                    ],
                },
            ],
            relations: {
                outgoing: [
                    {
                        kind: "internal",
                        label: "WebApp Primary GUI Client",
                        targetDocumentId: "webapp-primary-gui-client",
                        targetPath: "decisions/webapp-primary-gui-client.md",
                    },
                ],
                backlinks: [
                    {
                        kind: "internal",
                        label: "Implement WebApp V2 Dashboard Shell",
                        targetDocumentId: "implement-webapp-v2-dashboard-shell",
                        targetPath: "tasks/implement-webapp-v2-dashboard-shell.md",
                    },
                ],
            },
        },
        {
            id: "implement-webapp-v2-dashboard-shell",
            path: "tasks/implement-webapp-v2-dashboard-shell.md",
            title: "Implement WebApp V2 Dashboard Shell",
            summary: "Fake-data shell with WebApp-local Tailwind, shadcn/ui, and Base UI.",
            space: "tasks",
            updatedAt: weeklyMockUpdatedAt,
            updatedLabel: formatRelativeDateTime(weeklyMockUpdatedAt),
            status: "warning",
            body: [
                {
                    type: "paragraph",
                    text: "Implement a fake-data WebApp V2 shell that can be reviewed in the in-app browser before the Rust read model is wired into the UI.",
                },
                {
                    type: "heading",
                    level: 2,
                    text: "Acceptance Criteria",
                },
                {
                    type: "list",
                    items: [
                        "The app presents Dashboard, Spaces, Documents, and Views as first-class routes.",
                        "The document detail route shows metadata, rendered content, outgoing links, backlinks, and diagnostics.",
                        "The shell supports collapsed sidebar navigation and independent scrolling for the content and context panel.",
                    ],
                },
                {
                    type: "heading",
                    level: 2,
                    text: "Implementation Notes",
                },
                {
                    type: "paragraph",
                    text: "The current implementation keeps the read model deterministic and local to the WebApp package. Real Markdown parsing and indexing should be provided by the Rust backend later.",
                },
                {
                    type: "code",
                    language: "ts",
                    code: 'const routes = ["/", "/spaces", "/documents", "/views"];\nconst mode = "read-only";',
                },
                {
                    type: "heading",
                    level: 3,
                    text: "Open Questions",
                },
                {
                    type: "table",
                    columns: ["Area", "Question", "Current choice"],
                    rows: [
                        ["References", "Should mentions be included?", "No, only explicit links"],
                        ["Proposals", "Should the WebApp expose a queue?", "Deferred"],
                        ["Reader", "Should source mode ship now?", "Deferred"],
                    ],
                },
            ],
            relations: {
                outgoing: [
                    {
                        kind: "internal",
                        label: "WebApp V2 Dashboard Design",
                        targetDocumentId: "webapp-v2-dashboard-design",
                        targetPath: "design/webapp-v2-dashboard-design.md",
                    },
                    {
                        kind: "internal",
                        label: "WebApp Primary GUI Client",
                        targetDocumentId: "webapp-primary-gui-client",
                        targetPath: "decisions/webapp-primary-gui-client.md",
                    },
                    {
                        kind: "external",
                        label: "Vite build guide",
                        targetPath: "https://vite.dev/guide/build",
                    },
                    {
                        kind: "unresolved",
                        label: "Source mode design",
                        targetPath: "design/source-mode.md",
                    },
                ],
                backlinks: [],
            },
        },
    ],
    diagnostics: [
        {
            severity: "warning",
            code: "read-model",
            message: "Document links and diagnostics are currently backed by deterministic mock data.",
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
            space: "tasks",
        },
        {
            id: "recent-documents",
            title: "Recent Documents",
            description: "Recently updated documents across all spaces.",
            kind: "list",
        },
        {
            id: "document-inventory",
            title: "Document Inventory",
            description: "Structured document table with space, status, and update fields.",
            kind: "table",
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
    getDocument(documentId) {
        const document = dashboard.documents.find((item) => item.id === documentId);

        if (!document) {
            return Promise.reject(new Error(`Document not found: ${documentId}`));
        }

        return Promise.resolve(document);
    },
    getViewProjection(viewId) {
        const view = dashboard.views.find((item) => item.id === viewId);

        if (!view) {
            return Promise.reject(new Error(`View not found: ${viewId}`));
        }

        const documents = view.space
            ? dashboard.documents.filter((document) => document.space === view.space)
            : dashboard.documents;

        if (view.kind === "kanban") {
            const columns: Extract<DashboardViewProjection, { kind: "kanban" }>["columns"] = [
                {
                    id: "warning",
                    items: documents
                        .filter((document) => document.status === "warning")
                        .map((document) => ({
                            documentId: document.id,
                            fields: {
                                status: document.status,
                                updated: document.updatedLabel,
                            },
                            path: document.path,
                            title: document.title,
                        })),
                    label: "Needs Review",
                },
                {
                    id: "healthy",
                    items: documents
                        .filter((document) => document.status === "healthy")
                        .map((document) => ({
                            documentId: document.id,
                            fields: {
                                status: document.status,
                                updated: document.updatedLabel,
                            },
                            path: document.path,
                            title: document.title,
                        })),
                    label: "Healthy",
                },
            ];

            return Promise.resolve({ columns, kind: "kanban" });
        }

        if (view.kind === "list") {
            return Promise.resolve({
                items: documents.map((document) => ({
                    documentId: document.id,
                    fields: {
                        space: document.space,
                        status: document.status,
                        summary: document.summary,
                        updated: document.updatedLabel,
                    },
                    path: document.path,
                    title: document.title,
                })),
                kind: "list",
            });
        }

        if (view.kind === "graph") {
            return Promise.resolve({
                kind: "graph",
                nodes: documents.map((document) => ({
                    space: document.space,
                    documentId: document.id,
                    id: document.path,
                    kind: document.kind,
                    path: document.path,
                    title: document.title,
                })),
                edges: documents.flatMap((document) =>
                    document.relations.outgoing
                        .filter((link) => link.targetPath && documents.some((item) => item.path === link.targetPath))
                        .map((link) => ({
                            id: `${document.path}->${link.targetPath}`,
                            intent: "link" as const,
                            referenceSource: "body" as const,
                            source: document.path,
                            sourcePath: document.path,
                            target: link.targetPath,
                            targetPath: link.targetPath,
                        })),
                ),
            });
        }

        return Promise.resolve({
            columns: ["space", "status", "updated"],
            items: documents.map((document) => ({
                documentId: document.id,
                fields: {
                    space: document.space,
                    status: document.status,
                    updated: document.updatedLabel,
                },
                path: document.path,
                title: document.title,
            })),
            kind: "table",
        });
    },
};
