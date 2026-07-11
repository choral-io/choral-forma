import { describe, expect, it } from "vitest";

import type { ViewRenderResult } from "@choral-forma/shared";

import { renderViewHtml, splitBodyAtMount } from "./preview-renderer.ts";

const workspace = { root: ".", name: "Preview fixture" };

describe("view preview rendering", () => {
    it("preserves Markdown before and after the source-mapped mount", () => {
        expect(splitBodyAtMount("# Before\n<!-- forma:content -->\nAfter", 9, 31)).toEqual(["# Before\n", "\nAfter"]);
        expect(splitBodyAtMount("🧭<!-- forma:content -->After", 2, 24)).toEqual(["🧭", "After"]);
    });

    it("renders themed list links and a strict CSP", () => {
        const result = {
            schemaVersion: 1,
            operation: "view.render",
            status: "passed",
            workspace,
            view: { id: "tasks", path: ".forma/views/tasks.md", surface: "page", mode: "list" },
            document: { bodySource: "# Tasks\n<!-- forma:content -->\nSaved source.", mounts: [] },
            render: { kind: "list", items: [{ path: "tasks/one.md", title: "One" }] },
        } satisfies ViewRenderResult;
        const html = renderViewHtml(result, "nonce", "vscode-webview:");
        expect(html).toContain("--vscode-editor-background");
        expect(html).toContain("vscode-high-contrast");
        expect(html).toContain("prefers-reduced-motion");
        expect(html).toContain("--vscode-editor-font-family");
        expect(html).toContain("default-src 'none'");
        expect(html).toContain('data-open-source="tasks/one.md"');
        expect(html).toContain("Saved source.");
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
        expect(renderViewHtml(result, "nonce", "vscode-webview:")).toContain("Graph preview is deferred");
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
        expect(renderViewHtml(empty, "nonce", "vscode-webview:")).toContain("Empty view");
        expect(renderViewHtml(invalid, "nonce", "vscode-webview:")).toContain("View needs attention");
    });

    it("renders configured table and kanban projections with narrow-group overflow", () => {
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

        expect(renderViewHtml(table, "nonce", "vscode-webview:")).toContain("Delivery status");
        const kanbanHtml = renderViewHtml(kanban, "nonce", "vscode-webview:");
        expect(kanbanHtml).toContain("Doing");
        expect(kanbanHtml).toContain("overflow-x: auto");
        expect(kanbanHtml).toContain('data-open-source="tasks/one.md"');
    });
});
