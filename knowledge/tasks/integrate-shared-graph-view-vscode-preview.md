---
schemaVersion: 1
kind: task
scope: project
title: Integrate Shared Graph View With VS Code Preview
summary: Hydrate the shared Graph renderer inside native Markdown Preview with VS Code theme, navigation, active-document, reload, and Remote lifecycle adapters.
type: task
priority: P1
value: H
module: app
effort: M
status: backlog
readiness: blocked
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - graph
    - vscode
    - markdown-preview
    - shared-renderer
blockedBy:
    - "tasks/implement-shared-graph-view-runtime"
relatedTo:
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/design-editor-graph-view-renderer"
    - "tasks/implement-vscode-view-preview"
    - "tasks/validate-shared-graph-view-cross-host-parity"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code native Markdown Preview script, Graph hydration, active editor following, navigation, and lifecycle
---

# Integrate Shared Graph View With VS Code Preview

## Goal

Render configured Graph Views through the shared runtime inside VS Code's native Markdown Preview without introducing a second preview surface.

## Sources

- [[discovery/editor-graph-view-technical-research-2026-07-17]]
- [[tasks/implement-shared-graph-view-runtime]]
- [[architecture/editor-extension-adapter-contract]]
- [[tasks/implement-vscode-view-preview]]

## In Scope

- Build a browser-targeted Preview entrypoint and contribute it through `markdown.previewScripts`.
- Encode the Graph projection as inert data with a progressively useful accessible fallback and hydrate only Graph mounts.
- Keep non-Graph Markdown Preview behavior unchanged.
- Map VS Code Preview theme variables, high contrast, editor fonts, focus treatment, and reduced motion to shared semantic Graph roles.
- Track open Graph View previews and map the active managed editor document to shared `activeNodeId` without rerunning `forma view render` for every editor switch.
- Delegate double click, Enter, and details actions to native Preview source links.
- Make hydration idempotent and release renderer, Worker, observer, timer, and listener resources on save refresh, reload, tab disposal, and extension disposal.
- Validate packaged VSIX and VS Code Remote behavior for browser bundle and Worker resource loading.

## Out Of Scope

- A custom editor or second WebView-based Preview.
- VS Code-specific graph layout, reducers, styling rules, or interaction semantics.
- Frontmatter-defined groups and filters.
- A VS Code-only 3D mode.

## Acceptance Criteria

- A configured Graph View renders through native Markdown Preview using `packages/graph-view` rather than a VS Code-local renderer.
- The browser script no-ops for documents without a Graph mount and executes no workspace-provided code.
- Active managed document changes update Graph selection and centering from cached projection data; they do not invoke a full CLI render solely to change focus.
- Node source activation preserves native Markdown Preview navigation behavior.
- Light, dark, high-contrast, reduced-motion, reload, reopened-preview, and extension-restart cases recover correctly.
- Packaged local and Remote Extension Host tests prove browser and Worker assets resolve from the installed extension.
- Preview reload and disposal tests show no retained renderer, Worker, observer, timer, or listener lifecycle leaks.
