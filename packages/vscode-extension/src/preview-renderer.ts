import type { Diagnostic, ViewRenderItem, ViewRenderOutput, ViewRenderResult } from "@choral-forma/shared";

export function renderViewProjectionHtml(result: ViewRenderResult): string {
    const sourcePath = result.view?.path ?? "";
    return `<section class="forma-view" data-forma-view>${renderProjection(result.view?.mode, result.render, result.diagnostics ?? [], sourcePath)}</section>`;
}

function renderProjection(
    mode: string | undefined,
    render: ViewRenderOutput | undefined,
    diagnostics: Diagnostic[],
    sourcePath: string,
): string {
    if (mode === "graph") {
        return `<section class="state deferred"><h2>Graph preview is deferred</h2><p>This release keeps the graph view editable while a focused renderer design is completed.</p>${sourceButton(sourcePath)}${renderDiagnostics(diagnostics, sourcePath)}</section>`;
    }
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        return `<section class="state error" role="alert"><h2>View needs attention</h2>${renderDiagnostics(diagnostics, sourcePath)}${sourceButton(sourcePath)}</section>`;
    }
    if (!render)
        return `<section class="state"><h2>No projection</h2><p>Save a valid Forma view to render its projection.</p>${sourceButton(sourcePath)}</section>`;
    switch (render.kind) {
        case "list":
            return render.items.length === 0
                ? emptyState("No entries match this view.")
                : `<ul class="entry-list">${render.items.map(renderItemLink).join("")}</ul>`;
        case "table":
            return render.items.length === 0
                ? emptyState("No entries match this table.")
                : `<div class="table-wrap"><table><thead><tr>${render.columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${render.items
                      .map(
                          (item) =>
                              `<tr>${render.columns.map((column, index) => `<td>${index === 0 ? itemButton(item, fieldValue(item, column.field)) : escapeHtml(fieldValue(item, column.field))}</td>`).join("")}</tr>`,
                      )
                      .join("")}</tbody></table></div>`;
        case "kanban":
            return `<div class="kanban" role="region" aria-label="Kanban board" tabindex="0">${render.columns
                .map(
                    (column) =>
                        `<section class="kanban-column"><h2>${column.icon ? `<span aria-hidden="true">${escapeHtml(column.icon)}</span> ` : ""}${escapeHtml(column.label)} <span class="count">${String(column.items.length)}</span></h2>${column.items.length === 0 ? '<p class="muted">No entries</p>' : column.items.map((item) => `<article class="card">${itemButton(item, item.title ?? item.path)}${renderBadges(item)}</article>`).join("")}</section>`,
                )
                .join("")}</div>`;
        case "graph":
            return `<section class="state deferred"><h2>Graph preview is deferred</h2><p>This release keeps the graph view editable while a focused renderer design is completed.</p>${sourceButton(sourcePath)}${renderDiagnostics(diagnostics, sourcePath)}</section>`;
    }
}

function renderItemLink(item: ViewRenderItem): string {
    return `<li>${itemButton(item, item.title ?? item.path)}</li>`;
}

function itemButton(item: ViewRenderItem, label: string): string {
    return `<a class="source-link" href="/${escapeAttribute(item.path)}" data-open-source="${escapeAttribute(item.path)}">${escapeHtml(label)}</a>`;
}

function sourceButton(path: string): string {
    return `<a class="source-link" href="/${escapeAttribute(path)}" data-open-source="${escapeAttribute(path)}">Open editable source</a>`;
}

function renderBadges(item: ViewRenderItem): string {
    const badges = Object.entries(item.fields ?? {})
        .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        .slice(0, 3)
        .map(
            ([key, value]) =>
                `<span class="badge"><span class="sr-only">${escapeHtml(key)}: </span>${escapeHtml(String(value))}</span>`,
        )
        .join("");
    return badges ? `<div class="badges">${badges}</div>` : "";
}

function fieldValue(item: ViewRenderItem, field: string): string {
    if (field === "path") return item.path;
    if (field === "title" || field === "fields.title") return item.title ?? item.path;
    const key = field.replace(/^fields\./u, "");
    const value = item.fields?.[field] ?? item.fields?.[key];
    return value === undefined || value === null
        ? ""
        : Array.isArray(value)
          ? value.map(formatFieldValue).join(", ")
          : formatFieldValue(value);
}

function formatFieldValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
    return JSON.stringify(value);
}

function renderDiagnostics(diagnostics: Diagnostic[], fallbackPath: string): string {
    if (diagnostics.length === 0) return "";
    return `<ul class="diagnostics">${diagnostics
        .map((diagnostic) => {
            const line = diagnostic.location?.kind === "body" ? diagnostic.location.line : undefined;
            const column = diagnostic.location?.kind === "body" ? diagnostic.location.column : undefined;
            const path = diagnostic.path ?? fallbackPath;
            return `<li><strong>${escapeHtml(diagnostic.code)}</strong>: ${escapeHtml(diagnostic.message)} <a class="source-link" href="/${escapeAttribute(path)}" data-open-source="${escapeAttribute(path)}"${line ? ` data-line="${String(line)}"` : ""}${column ? ` data-column="${String(column)}"` : ""}>Open source</a></li>`;
        })
        .join("")}</ul>`;
}

function emptyState(message: string): string {
    return `<section class="state empty"><h2>Empty view</h2><p>${escapeHtml(message)}</p></section>`;
}

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
    return escapeHtml(value).replaceAll("'", "&#39;");
}
