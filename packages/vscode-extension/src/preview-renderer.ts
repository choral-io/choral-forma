import type { Diagnostic, ViewRenderItem, ViewRenderOutput, ViewRenderResult } from "@choral-forma/shared";

export type ViewRenderOptions = {
    locale?: string;
    timeZone?: string;
};

type TableRenderOutput = Extract<ViewRenderOutput, { kind: "table" }>;
type KanbanRenderOutput = Extract<ViewRenderOutput, { kind: "kanban" }>;

export function renderViewProjectionHtml(result: ViewRenderResult, options: ViewRenderOptions = {}): string {
    const sourcePath = result.view?.path ?? "";
    const projection = renderProjection(
        result.view?.mode,
        result.render,
        result.diagnostics ?? [],
        sourcePath,
        options,
    );
    return `<section class="forma-view" data-forma-view>${projection}</section>`;
}

function renderProjection(
    mode: string | undefined,
    render: ViewRenderOutput | undefined,
    diagnostics: Diagnostic[],
    sourcePath: string,
    options: ViewRenderOptions,
): string {
    if (mode === "graph") return renderDeferredGraph(sourcePath, diagnostics);
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        return `<section class="state error" role="alert"><h2>View needs attention</h2>${renderDiagnostics(diagnostics, sourcePath)}${sourceButton(sourcePath)}</section>`;
    }
    if (!render) {
        return `<section class="state"><h2>No projection</h2><p>Save a valid Forma view to render its projection.</p>${sourceButton(sourcePath)}</section>`;
    }

    switch (render.kind) {
        case "list":
            return render.items.length === 0
                ? emptyState("No entries match this view.")
                : `<ul class="entry-list">${render.items.map(renderItemLink).join("")}</ul>`;
        case "table":
            return renderTable(render, options);
        case "kanban":
            return renderKanban(render, options);
        case "graph":
            return renderDeferredGraph(sourcePath, diagnostics);
    }
}

function renderTable(render: TableRenderOutput, options: ViewRenderOptions): string {
    if (render.items.length === 0) return emptyState("No entries match this table.");
    const headings = render.columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("");
    const rows = render.items
        .map((item) => {
            const cells = render.columns
                .map((column, index) => {
                    const value = rawFieldValue(item, column.field);
                    const content =
                        index === 0
                            ? itemButton(item, firstNonEmpty(plainFieldValue(value), item.title, item.path))
                            : renderFieldValue(value, options);
                    return `<td>${content}</td>`;
                })
                .join("");
            return `<tr>${cells}</tr>`;
        })
        .join("");
    return `<div class="table-wrap"><table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderKanban(render: KanbanRenderOutput, options: ViewRenderOptions): string {
    const columns = render.columns
        .map((column) => {
            const icon = column.icon ? `<span aria-hidden="true">${escapeHtml(column.icon)}</span> ` : "";
            const items =
                column.items.length === 0
                    ? '<p class="muted">No entries</p>'
                    : column.items.map((item) => renderKanbanCard(item, render.card, options)).join("");
            return `<section class="kanban-column"><h2>${icon}${escapeHtml(column.label)} <span class="count">${String(column.items.length)}</span></h2>${items}</section>`;
        })
        .join("");
    return `<div class="kanban" role="region" aria-label="Kanban board">${columns}</div>`;
}

function renderKanbanCard(item: ViewRenderItem, card: KanbanRenderOutput["card"], options: ViewRenderOptions): string {
    const title = firstNonEmpty(plainFieldValue(rawFieldValue(item, card.titleField)), item.title, item.path);
    const subtitles = renderCardFields(item, card.subtitleFields ?? [], "card-subtitle", options);
    const badges = renderCardFields(item, card.badgeFields ?? [], "badge", options);
    return `<article class="card">${itemButton(item, title)}${subtitles ? `<div class="card-subtitles">${subtitles}</div>` : ""}${badges ? `<div class="badges">${badges}</div>` : ""}</article>`;
}

function renderCardFields(
    item: ViewRenderItem,
    fields: readonly string[],
    className: string,
    options: ViewRenderOptions,
): string {
    return fields
        .map((field) => {
            const value = rawFieldValue(item, field);
            if (value === undefined || value === null || plainFieldValue(value) === "") return "";
            return `<span class="${className}"><span class="sr-only">${escapeHtml(fieldLabel(field))}: </span>${renderFieldValue(value, options)}</span>`;
        })
        .join("");
}

function renderDeferredGraph(sourcePath: string, diagnostics: Diagnostic[]): string {
    return `<section class="state deferred"><h2>Graph preview is deferred</h2><p>This release keeps the graph view editable while a focused renderer design is completed.</p>${sourceButton(sourcePath)}${renderDiagnostics(diagnostics, sourcePath)}</section>`;
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

function rawFieldValue(item: ViewRenderItem, field: string): unknown {
    if (field === "path" || field === "entry.path") return item.path;
    if (field === "title" || field === "entry.title") return item.title ?? item.path;
    const key = field.replace(/^fields\./u, "");
    return item.fields?.[field] ?? item.fields?.[key];
}

function plainFieldValue(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.map(plainFieldValue).filter(Boolean).join(", ");
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
    return JSON.stringify(value);
}

function firstNonEmpty(...values: Array<string | undefined>): string {
    return values.find((value) => value !== undefined && value.length > 0) ?? "";
}

function renderFieldValue(value: unknown, options: ViewRenderOptions): string {
    if (Array.isArray(value)) return value.map((entry) => renderFieldValue(entry, options)).join(", ");
    if (typeof value === "string") return renderTemporalValue(value, options) ?? escapeHtml(value);
    return escapeHtml(plainFieldValue(value));
}

function renderTemporalValue(value: string, options: ViewRenderOptions): string | undefined {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(value);
    const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value);
    if (!dateOnly && !dateTime) return undefined;

    const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(date.getTime())) return undefined;
    const formatter = new Intl.DateTimeFormat(options.locale, {
        dateStyle: "medium",
        ...(dateTime ? { timeStyle: "short" as const } : {}),
        ...(dateOnly ? { timeZone: "UTC" } : options.timeZone ? { timeZone: options.timeZone } : {}),
    });
    return `<time datetime="${escapeAttribute(value)}" title="${escapeAttribute(value)}">${escapeHtml(formatter.format(date))}</time>`;
}

function fieldLabel(field: string): string {
    return field.replace(/^fields\./u, "");
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
