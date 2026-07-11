import type { Diagnostic, ViewRenderItem, ViewRenderOutput, ViewRenderResult } from "@choral-forma/shared";

export function renderViewHtml(result: ViewRenderResult, nonce: string, cspSource: string): string {
    const sourcePath = result.view?.path ?? "";
    const body = result.document?.bodySource ?? "";
    const mount = result.document?.mounts[0];
    const [before, after] = splitBodyAtMount(body, mount?.startOffset, mount?.endOffset);
    const projection = renderProjection(result.view?.mode, result.render, result.diagnostics ?? [], sourcePath);
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${themeCss}</style>
</head>
<body>
<header class="toolbar"><strong>${escapeHtml(result.view?.title ?? "Forma View")}</strong><button data-open-source="${escapeAttribute(sourcePath)}">Open Source</button></header>
<main>${renderMarkdown(before)}${projection}${renderMarkdown(after)}</main>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-open-source]') : null;
  if (target) vscode.postMessage({ type: 'openSource', path: target.getAttribute('data-open-source'), line: Number(target.getAttribute('data-line')) || undefined, column: Number(target.getAttribute('data-column')) || undefined });
});
document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.matches('[data-open-source]')) event.target.click();
});
</script>
</body>
</html>`;
}

export function splitBodyAtMount(body: string, startOffset?: number, endOffset?: number): [string, string] {
    if (startOffset !== undefined && endOffset !== undefined && startOffset >= 0 && endOffset >= startOffset) {
        return [body.slice(0, startOffset), body.slice(endOffset)];
    }
    const marker = "<!-- forma:content -->";
    const index = body.indexOf(marker);
    return index < 0 ? [body, ""] : [body.slice(0, index), body.slice(index + marker.length)];
}

function renderProjection(
    mode: string | undefined,
    render: ViewRenderOutput | undefined,
    diagnostics: Diagnostic[],
    sourcePath: string,
): string {
    if (mode === "graph") {
        return `<section class="state deferred"><h2>Graph preview is deferred</h2><p>Alpha 13 keeps this graph view editable while a focused renderer design is completed.</p>${sourceButton(sourcePath)}${renderDiagnostics(diagnostics, sourcePath)}</section>`;
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
            return `<section class="state deferred"><h2>Graph preview is deferred</h2><p>Alpha 13 keeps this graph view editable while a focused renderer design is completed.</p>${sourceButton(sourcePath)}${renderDiagnostics(diagnostics, sourcePath)}</section>`;
    }
}

function renderItemLink(item: ViewRenderItem): string {
    return `<li>${itemButton(item, item.title ?? item.path)}</li>`;
}

function itemButton(item: ViewRenderItem, label: string): string {
    return `<button class="source-link" data-open-source="${escapeAttribute(item.path)}">${escapeHtml(label)}</button>`;
}

function sourceButton(path: string): string {
    return `<button data-open-source="${escapeAttribute(path)}">Open editable source</button>`;
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
            return `<li><strong>${escapeHtml(diagnostic.code)}</strong>: ${escapeHtml(diagnostic.message)} <button class="source-link" data-open-source="${escapeAttribute(diagnostic.path ?? fallbackPath)}"${line ? ` data-line="${String(line)}"` : ""}${column ? ` data-column="${String(column)}"` : ""}>Open source</button></li>`;
        })
        .join("")}</ul>`;
}

function emptyState(message: string): string {
    return `<section class="state empty"><h2>Empty view</h2><p>${escapeHtml(message)}</p></section>`;
}

function renderMarkdown(markdown: string): string {
    const lines = markdown.trim().split(/\r?\n/u);
    if (lines.length === 1 && lines[0] === "") return "";
    return `<section class="markdown">${lines
        .map((line) => {
            const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
            if (heading?.[1] && heading[2]) {
                const level = heading[1].length;
                return `<h${String(level)}>${inlineMarkdown(heading[2])}</h${String(level)}>`;
            }
            if (/^\s*[-*]\s+/u.test(line))
                return `<p class="list-line">• ${inlineMarkdown(line.replace(/^\s*[-*]\s+/u, ""))}</p>`;
            return line.trim() ? `<p>${inlineMarkdown(line)}</p>` : "";
        })
        .join("")}</section>`;
}

function inlineMarkdown(value: string): string {
    return escapeHtml(value)
        .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
        .replace(/`([^`]+)`/gu, "<code>$1</code>");
}

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
    return escapeHtml(value).replaceAll("'", "&#39;");
}

const themeCss = `
:root {
  --forma-background: var(--vscode-editor-background);
  --forma-foreground: var(--vscode-editor-foreground);
  --forma-border: var(--vscode-panel-border, var(--vscode-contrastBorder, transparent));
  --forma-focus: var(--vscode-focusBorder);
  --forma-selection: var(--vscode-editor-selectionBackground);
  --forma-muted: var(--vscode-descriptionForeground);
  --forma-error: var(--vscode-errorForeground);
  --forma-warning: var(--vscode-editorWarning-foreground);
  --forma-card: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  --forma-font-family: var(--vscode-editor-font-family);
  --forma-font-size: var(--vscode-editor-font-size);
  --forma-font-weight: var(--vscode-editor-font-weight);
  --forma-chart-1: var(--vscode-charts-blue);
  --forma-chart-2: var(--vscode-charts-green);
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0 1.25rem 2rem; color: var(--forma-foreground); background: var(--forma-background); font-family: var(--forma-font-family); font-size: var(--forma-font-size); font-weight: var(--forma-font-weight); line-height: 1.55; }
button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 1px solid transparent; border-radius: 2px; padding: .35rem .6rem; cursor: pointer; font: inherit; }
button:hover { background: var(--vscode-button-hoverBackground); }
button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--forma-focus); outline-offset: 2px; }
.toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem 0; background: var(--forma-background); border-bottom: 1px solid var(--forma-border); }
main { max-width: 100%; }
.markdown { max-width: 72ch; }
.entry-list { padding-left: 1.25rem; }
.source-link { color: var(--vscode-textLink-foreground); background: transparent; border: 0; padding: .2rem 0; text-align: left; }
.source-link:hover { color: var(--vscode-textLink-activeForeground); background: transparent; text-decoration: underline; }
.table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--forma-border); }
table { width: 100%; min-width: 36rem; border-collapse: collapse; }
th, td { padding: .55rem .7rem; border-bottom: 1px solid var(--forma-border); text-align: left; vertical-align: top; }
th { background: var(--vscode-editorGroupHeader-tabsBackground, var(--forma-card)); }
.kanban { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(16rem, 22rem); gap: .75rem; max-width: 100%; overflow-x: auto; padding: .25rem 0 1rem; }
.kanban-column { border: 1px solid var(--forma-border); border-radius: 4px; background: var(--forma-card); padding: .65rem; }
.kanban-column h2 { margin: 0 0 .65rem; font-size: 1rem; }
.count { color: var(--forma-muted); font-weight: normal; }
.card { margin: .5rem 0; padding: .6rem; border: 1px solid var(--forma-border); border-left: 3px solid var(--forma-chart-1); background: var(--forma-background); }
.badges { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: .4rem; }
.badge { border: 1px solid var(--forma-border); border-radius: 999px; padding: .05rem .4rem; color: var(--forma-muted); font-size: .85em; }
.state { margin: 1rem 0; padding: 1rem; border: 1px solid var(--forma-border); border-left: 3px solid var(--forma-chart-2); }
.state.error { border-left-color: var(--forma-error); }
.state.deferred { border-left-color: var(--forma-warning); }
.muted { color: var(--forma-muted); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
::selection { background: var(--forma-selection); }
.vscode-high-contrast .card, .vscode-high-contrast .state, .vscode-high-contrast .kanban-column, .vscode-high-contrast table { border-width: 2px; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
`;
