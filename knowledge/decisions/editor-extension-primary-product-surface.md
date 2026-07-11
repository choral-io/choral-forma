---
scope: project
type: decision
owners:
    - "members/tiscs"
reviewers: []
tags:
    - product
    - architecture
    - editor-extension
    - vscode
    - gui
supersedes:
    - "decisions/webapp-primary-gui-client"
supersededBy: []
---

# Editor Extension Primary Product Surface

## Context

Choral Forma has completed a public read-only WebApp baseline over the shared Rust core, operation model, HTTP RPC, and TypeScript result types. That work proved that configured spaces, files, references, diagnostics, and views can be projected without moving source-of-truth data out of repository Markdown.

The next product phase needs to validate a more important question: whether Forma improves daily authoring and maintenance work inside the editors where users already write Markdown. Continuing to expand the WebApp would create a second application surface while leaving that authoring loop unproven.

The product remains editor-independent. Repository Markdown and explicit Forma configuration remain the durable source of truth, and editor-specific code must not reimplement Forma semantics.

## Decision

Editor extensions are the primary product surface for the next development phase. VS Code is the first implementation target. Zed follows only after the shared adapter contract and VS Code MVP validate the model.

The existing WebApp enters maintenance mode. Forma keeps its built-in read-only WebApp, embedded serving path, release checks, and reusable renderer or data-mapping code, but new product-surface investment should target editor workflows unless a WebApp change is required for compatibility, regression repair, or shared renderer extraction.

Forma Core and its typed operations remain the capability layer. Editor extensions may discover a workspace, invoke stable CLI or RPC operations, map structured results into editor-native features, and host replaceable preview renderers. They must not parse workspace configuration, resolve references, evaluate views, or implement schema semantics independently.

## First Product Loop

The first editor extension should prove three connected capabilities:

1. Discover the nearest applicable `.forma.md` workspace entrypoint and report its health.
2. Navigate ordinary Markdown links, wikilinks, embeds, and schema-declared entry references through Forma-owned resolution.
3. Preview Markdown-backed list, table, and kanban views while keeping the view source directly editable. Graph remains a recognized view mode but its new editor renderer follows as a focused project after the first extension release.

## Consequences

- VS Code extension work moves into the next executable product slice.
- Zed remains a later adapter and should reuse editor-independent contracts proven by VS Code.
- The WebApp is retained rather than removed, but WebApp-only dashboard, AI Chat, and visual-polish work is deferred.
- View source always opens as ordinary Markdown by default. Generated projections are derived previews, never a replacement source format.
- Editor preview renderers must consume structured `view.render` data and editor theme tokens rather than WebApp-specific theme state.
- The current WebApp graph renderer is not the visual baseline for the editor extension. Alpha 13 may show a clear deferred state for graph views; a later focused project will validate layout and interaction while preserving the graph data contract.
- Cross-editor behavior belongs in shared operation contracts and adapter-neutral TypeScript types. Editor APIs, commands, lifecycle, theme bridging, and WebView hosting remain adapter responsibilities.
- Write-capable kanban, graph, or metadata interactions remain deferred until reviewable operation and apply semantics are accepted.

## Alternatives Considered

### Continue With The WebApp As Primary GUI

This preserves one controlled application surface, but it delays validation of the primary Markdown authoring workflow and duplicates navigation that editors already provide.

### Remove The WebApp

This would discard a working validation surface and reusable read-oriented implementation. Maintenance mode preserves that value without continuing to make it the product center.

### Build VS Code And Zed Together

This would expose cross-editor differences before the adapter contract is proven. A VS Code-first sequence creates one concrete implementation from which the portable boundary can be extracted and tested.

## Related Knowledge

- [[product/choral-forma]]
- [[product/product-direction]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/editor-extension-adapter-contract]]
- [[design/editor-extension-mvp-design]]
- [[planning/editor-extension-mvp-roadmap]]

## Related Tasks

- [[tasks/design-editor-extension-adapter-contract]]
- [[tasks/implement-vscode-extension-mvp]]
- [[tasks/implement-zed-extension-mvp]]
- [[tasks/implement-interactive-graph-view-render]]
