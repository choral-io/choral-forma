import type { Diagnostic, ViewRenderItem, ViewRenderOutput, ViewRenderResult } from "@choral-forma/shared";

export type ViewRenderOptions = {
    activePath?: string;
    locale?: string;
    timeZone?: string;
};

type TableRenderOutput = Extract<ViewRenderOutput, { kind: "table" }>;
type KanbanRenderOutput = Extract<ViewRenderOutput, { kind: "kanban" }>;
type GraphRenderOutput = Extract<ViewRenderOutput, { kind: "graph" }>;

export function renderViewProjectionHtml(result: ViewRenderResult, options: ViewRenderOptions = {}): string {
    const sourcePath = result.view?.path ?? "";
    const projection = renderProjection(result.render, result.diagnostics ?? [], sourcePath, options);
    return `<section class="forma-view" data-forma-view>${projection}</section>`;
}

function renderProjection(
    render: ViewRenderOutput | undefined,
    diagnostics: Diagnostic[],
    sourcePath: string,
    options: ViewRenderOptions,
): string {
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
            return renderGraph(render, sourcePath, options.activePath);
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

function renderGraph(render: GraphRenderOutput, sourcePath: string, activePath: string | undefined): string {
    if (render.nodes.length === 0) return emptyState("No entries match this graph.");
    const graphId = `forma-graph-${stableHash(sourcePath)}`;
    const searchId = `${graphId}-search`;
    const activeNodeId = render.nodes.find((node) => node.path === activePath)?.id ?? null;
    const data = safeJson({
        schemaVersion: 1,
        activeNodeId,
        projection: render,
    });
    const legend = (render.legend ?? [])
        .map(
            (item) =>
                `<span class="graph-legend-item"><span aria-hidden="true" class="graph-legend-swatch"${item.color ? ` style="background:${escapeAttribute(item.color)}"` : ""}></span>${escapeHtml(item.label)}</span>`,
        )
        .join("");
    const nodes = render.nodes.slice(0, MAX_GRAPH_COMPANION_NODES).map(renderGraphNodeLink).join("");
    return `<div class="graph-shell"><div class="graph-stage" id="${graphId}" data-forma-graph-host></div><button class="graph-expand-button" data-forma-graph-expand type="button" aria-label="Expand graph" title="Expand graph" hidden><span aria-hidden="true">⛶</span></button><aside class="graph-summary" data-forma-graph-summary hidden aria-live="polite"></aside></div>${legend ? `<section class="graph-legend" aria-label="Graph node colors">${legend}</section>` : ""}<section class="graph-companion" aria-label="Graph nodes"><label for="${searchId}">Search graph nodes</label><input id="${searchId}" data-forma-graph-search type="search" placeholder="Title or path"><p class="muted" data-forma-graph-count aria-live="polite">Showing ${String(Math.min(render.nodes.length, MAX_GRAPH_COMPANION_NODES))} of ${String(render.nodes.length)} nodes.</p><div class="graph-node-list" data-forma-graph-node-list>${nodes}</div></section><script type="application/json" data-forma-graph-data>${data}</script><p class="graph-source-action">${sourceButton(sourcePath)}</p>`;
}

const MAX_GRAPH_COMPANION_NODES = 100;

function renderGraphNodeLink(node: GraphRenderOutput["nodes"][number]): string {
    const title = node.title ?? node.path;
    const classification = node.classification?.label
        ? `<span class="graph-node-classification">${escapeHtml(node.classification.label)}</span>`
        : "";
    return `<a class="graph-node-link" href="/${escapeAttribute(node.path)}" data-forma-graph-node-id="${escapeAttribute(node.id)}"><span class="graph-node-title">${escapeHtml(title)}</span><span class="graph-node-path">${escapeHtml(node.path)}</span>${classification}</a>`;
}

function safeJson(value: unknown): string {
    return JSON.stringify(value)
        .replaceAll("<", "\\u003c")
        .replaceAll(">", "\\u003e")
        .replaceAll("&", "\\u0026")
        .replaceAll("\u2028", "\\u2028")
        .replaceAll("\u2029", "\\u2029");
}

function stableHash(value: string): string {
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return (hash >>> 0).toString(36);
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
