import { describe, expect, it } from "vitest";

import type { ViewRenderResult } from "@choral-forma/shared";

import { renderViewProjectionHtml } from "./preview-renderer.ts";

const workspace = { root: ".", name: "Preview fixture" };

describe("view projection rendering", () => {
    it("renders list links for the native Markdown preview", () => {
        const result = {
            schemaVersion: 1,
            operation: "view.render",
            status: "passed",
            workspace,
            view: { id: "tasks", path: ".forma/views/tasks.md", surface: "page", mode: "list" },
            render: { kind: "list", items: [{ path: "tasks/one.md", title: "One" }] },
        } satisfies ViewRenderResult;
        const html = renderViewProjectionHtml(result);
        expect(html).toContain("data-forma-view");
        expect(html).toContain('href="/tasks/one.md"');
        expect(html).toContain('data-open-source="tasks/one.md"');
    });

    it("renders an inert Graph mount and accessible source fallback", () => {
        const result = {
            schemaVersion: 1,
            operation: "view.render",
            status: "passed",
            workspace,
            view: { id: "graph", path: ".forma/views/graph.md", surface: "page", mode: "graph" },
            render: {
                kind: "graph",
                nodes: [
                    {
                        id: "members/sam-rivera.md",
                        path: "members/sam-rivera.md",
                        title: "Sam Rivera </script>",
                        space: "members",
                        classification: {
                            key: "areas:people",
                            taxonomy: "areas",
                            label: "People",
                        },
                    },
                ],
                edges: [],
                legend: [
                    {
                        key: "areas:people",
                        taxonomy: "areas",
                        label: "People",
                        color: "#4F7CAC",
                    },
                ],
            },
        } satisfies ViewRenderResult;
        const html = renderViewProjectionHtml(result, { activePath: "members/sam-rivera.md" });
        expect(html).toContain("data-forma-graph-host");
        expect(html).toContain('type="application/json" data-forma-graph-data');
        expect(html).toContain('href="/members/sam-rivera.md"');
        expect(html).toContain('"activeNodeId":"members/sam-rivera.md"');
        expect(html).toContain("Sam Rivera &lt;/script&gt;");
        expect(html).toContain("\\u003c/script\\u003e");
        expect(html).not.toContain("Graph preview is deferred");
    });

    it("distinguishes empty projections from invalid views", () => {
        const empty = {
            schemaVersion: 1,
            operation: "view.render",
            status: "passed",
            workspace,
            view: { id: "list", path: ".forma/views/list.md", surface: "page", mode: "list" },
            render: { kind: "list", items: [] },
        } satisfies ViewRenderResult;
        const invalid = {
            schemaVersion: 1,
            operation: "view.render",
            status: "failed",
            workspace,
            view: { id: "list", path: ".forma/views/list.md", surface: "page", mode: "list" },
            diagnostics: [{ severity: "error", code: "view.invalid", message: "Invalid view." }],
        } satisfies ViewRenderResult;
        expect(renderViewProjectionHtml(empty)).toContain("Empty view");
        expect(renderViewProjectionHtml(invalid)).toContain("View needs attention");
    });

    it("renders configured table and kanban projections", () => {
        const table = {
            schemaVersion: 1,
            operation: "view.render",
            status: "passed",
            workspace,
            view: { id: "table", path: ".forma/views/table.md", surface: "page", mode: "table" },
            render: {
                kind: "table",
                columns: [{ field: "fields.status", label: "Delivery status" }],
                items: [{ path: "tasks/one.md", title: "One", fields: { "fields.status": "doing" } }],
            },
        } satisfies ViewRenderResult;
        const kanban = {
            schemaVersion: 1,
            operation: "view.render",
            status: "passed",
            workspace,
            view: { id: "board", path: ".forma/views/board.md", surface: "page", mode: "kanban" },
            render: {
                kind: "kanban",
                card: {
                    titleField: "fields.title",
                    subtitleFields: ["fields.summary"],
                    badgeFields: ["fields.priority", "fields.dueDate", "fields.updatedAt"],
                },
                columns: [
                    {
                        id: "doing",
                        label: "Doing",
                        icon: "●",
                        items: [
                            {
                                path: "tasks/one.md",
                                title: "Fallback title",
                                fields: {
                                    title: "One",
                                    summary: "A concise task summary.",
                                    priority: "P1",
                                    dueDate: "2026-07-19",
                                    updatedAt: "2026-07-19T13:30:00Z",
                                    createdAt: "2026-01-01T00:00:00Z",
                                },
                            },
                        ],
                    },
                    { id: "review", label: "Review", items: [] },
                    { id: "done", label: "Done", items: [] },
                ],
            },
        } satisfies ViewRenderResult;

        expect(renderViewProjectionHtml(table)).toContain("Delivery status");
        const kanbanHtml = renderViewProjectionHtml(kanban, { locale: "en-US", timeZone: "UTC" });
        expect(kanbanHtml).toContain("Doing");
        expect(kanbanHtml.match(/class="kanban-column"/g)).toHaveLength(3);
        expect(kanbanHtml).toContain('aria-label="Kanban board"');
        expect(kanbanHtml).toContain('href="/tasks/one.md"');
        expect(kanbanHtml).toContain("A concise task summary.");
        expect(kanbanHtml).toContain("P1");
        expect(kanbanHtml).toContain('<time datetime="2026-07-19"');
        expect(kanbanHtml).toContain(">Jul 19, 2026</time>");
        expect(kanbanHtml).toContain('<time datetime="2026-07-19T13:30:00Z"');
        expect(kanbanHtml).toContain(">Jul 19, 2026, 1:30 PM</time>");
        expect(kanbanHtml).not.toContain("2026-01-01T00:00:00Z");
    });
});
