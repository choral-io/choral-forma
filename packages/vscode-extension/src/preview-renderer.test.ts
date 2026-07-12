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

    it("shows a deliberate graph deferral", () => {
        const result = {
            schemaVersion: 1,
            operation: "view.render",
            status: "passed",
            workspace,
            view: { id: "graph", path: ".forma/views/graph.md", surface: "page", mode: "graph" },
            render: { kind: "graph", nodes: [], edges: [] },
        } satisfies ViewRenderResult;
        expect(renderViewProjectionHtml(result)).toContain("Graph preview is deferred");
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
                columns: [
                    {
                        id: "doing",
                        label: "Doing",
                        icon: "●",
                        items: [{ path: "tasks/one.md", title: "One", fields: { status: "doing" } }],
                    },
                ],
            },
        } satisfies ViewRenderResult;

        expect(renderViewProjectionHtml(table)).toContain("Delivery status");
        const kanbanHtml = renderViewProjectionHtml(kanban);
        expect(kanbanHtml).toContain("Doing");
        expect(kanbanHtml).toContain('aria-label="Kanban board"');
        expect(kanbanHtml).toContain('href="/tasks/one.md"');
    });
});
