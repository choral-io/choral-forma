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
status: doing
readiness: ready
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
blockedBy: []
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

## Result

- Added a browser-targeted `markdown.previewScripts` bundle that hydrates only inert Graph projections embedded in Forma View output. Non-Graph previews remain unchanged, and the browser code does not evaluate workspace-provided code.
- Kept graph construction, layout, taxonomy coloring, selection, one-hop emphasis, directional edges, active-layer rendering, and Sigma lifecycle in `packages/graph-view`. The VS Code adapter is limited to native Preview hydration, theme and typography token mapping, active-document updates, source navigation, and Preview lifecycle handling.
- Added a CSP-safe no-Worker layout mode for native Markdown Preview. Graph data and selection are updated incrementally from the cached View projection, without rerunning `forma view render` solely because the active editor changed.
- Raised the selected node, its direct neighbors, and emphasized edges above muted graph content. Emphasized edges use a dedicated post-node focus layer so inactive nodes and edges cannot obscure their direction indicators; the layer is redrawn after layout, camera, resize, and theme updates.
- Preserved selection across Preview content reloads and theme changes, restored Graph rendering after Reload Window, delegated node activation to native Markdown Preview links, and released runtime, observers, animation frames, and listeners on disposal.
- Corrected the Core View mount contract: a View without `<!-- forma:content -->` now appends its projection at the document end, while multiple mounts and the legacy marker remain invalid.
- Verified the shared Graph runtime (34 tests), VS Code extension (148 Vitest tests and 11 script tests), production browser bundle, packaged VSIX installation, native Preview reload, light/dark theme switching with an active selection, persistent focus edges after animation, and native source navigation. The packaged development VSIX was 200.51 KB; `markdown-preview.js` was 208,954 bytes (54,198 bytes gzip).
- Verified the same active-node and active-edge presentation in the WebApp against the running example workspace. The project workspace currently renders 163 nodes and 1,274 edges; its visible density is primarily caused by 187 incoming references to `knowledge/members/tiscs.md`, including 162 `owners`, 21 `assignees`, and 3 `reviewers` relationships.

Residual validation remains for a real Remote Extension Host, live high-contrast and reduced-motion sessions, long-running memory and idle-CPU profiling, and the planned 25/500/5,000-node cross-host performance gates. The project Graph's default relationship filters also need a separate product decision; assignment metadata has not been silently excluded from the configured View.
