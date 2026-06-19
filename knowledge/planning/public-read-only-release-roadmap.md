---
scope: project
type: roadmap
owners:
    - "members/Tiscs"
reviewers: []
tags:
    - forma
    - release
    - webapp
    - readonly
    - roadmap
sources:
    - "planning/webapp-primary-gui-roadmap"
    - "design/webapp-v2-dashboard-design"
    - "product/product-direction"
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "planning/KANBAN"
---

# Public Read-only Release Roadmap

## Goal

Define the remaining work needed to turn the current RPC-backed WebApp into the first public Choral Forma release.

The first public release should ship as a local, read-only, repository-backed knowledge browser. It should make workspace structure, documents, references, views, and diagnostics understandable without requiring editor integration or write-capable workflows.

## Release Positioning

The first public release is:

- a local `forma serve` WebApp for browsing a repository workspace;
- a read-only knowledge client over explicit Forma RPC operations;
- a document-centered Markdown reader with references, backlinks, outline, and diagnostics;
- a view browser for configured `list`, `table`, `kanban`, and `graph` views;
- a foundation for future lightweight interactions and editor adapters.

The first public release is not:

- a Markdown editor;
- an AI Chat or Agent execution surface;
- a write-capable proposal workflow;
- a VS Code or Zed extension;
- a full-text search product;
- a global graph product separate from configured views.

## Current Baseline

The current implementation already includes the main read-only loop:

- `forma serve` exposes WebApp assets, `/rpc`, and raw workspace resources.
- The WebApp uses real Forma RPC. Demo and validation data should come from example workspaces served by the backend, not from product-side mock clients.
- The current primary routes are Dashboard, Pages, Page detail, configured taxonomy groups, Views, and View detail.
- Page detail uses client-side Markdown rendering from backend-provided Markdown source, headings, references, and diagnostics.
- Page context includes overview data, outgoing links, backlinks, diagnostics, and an outline tab.
- Small screens use a context sheet instead of pushing the context panel below the document body.
- Saved views can render first-pass `list`, `table`, `kanban`, and `graph` projections.
- Quick Open exists as a WebApp-local navigation affordance over the current dashboard data.

## Public Release Work Packages

### 1. Release Boundary And RPC Contract

Stabilize the public read-only contract before adding more product surfaces.

- Confirm the public status of `workspace.dashboard`, `file.render`, `file.references`, and `view.render`.
- Document response shapes, date-time formatting expectations, diagnostics, path semantics, and empty/error result behavior.
- Keep mock data out of the product fallback path and product WebApp bundle. Use committed example workspaces served by the backend for demos and design review.
- Keep legacy or compatibility behavior out of the public contract unless it is intentionally documented.

Primary task:

- [[tasks/stabilize-public-read-only-webapp-release]]

### 2. Reader Quality

Make the Markdown reader good enough for ordinary repository Markdown.

- Keep persisted content ordinary Markdown.
- Keep backend responsibilities focused on source, references, headings, and diagnostics.
- Keep WebApp responsibilities focused on HTML rendering, sanitization, syntax highlighting, theme-aware styling, image loading, and reader presentation.
- Validate tables, task lists, blockquotes, code blocks, images, headings, internal links, external links, and long content on desktop and small screens.

Primary task:

- [[tasks/stabilize-public-read-only-webapp-release]]

### 3. Knowledge Health

Promote diagnostics from a generic side panel into a useful health surface.

- Show unresolved and ambiguous references.
- Show current diagnostics produced from source files and the in-memory read model.
- Show document-level diagnostics with navigation to affected documents.
- Show weak or isolated documents only when the signal is cheap and reliable.
- Do not implement automatic fixes or proposals in the first public release.

Primary task:

- [[tasks/expose-read-only-knowledge-health-in-webapp]]

### 4. Views And Graph

Treat views as configured read-only projections.

- Keep `graph` as a normal configured view renderer.
- Keep graph data derived from backend view render output, not browser-side Markdown scanning.
- Validate first-pass `list`, `table`, `kanban`, and `graph` behavior with representative fixtures.
- Improve graph readability, empty states, error states, theme behavior, and navigation without turning it into a separate global graph product.

Primary task:

- [[tasks/implement-interactive-graph-view-render]]

### 5. Quick Navigation

Keep Quick Open as the primary lightweight in-app discovery entry point.

- For the public release, Quick Open may continue to use dashboard data when it is clearly scoped to route, space, document, and view navigation.
- If Quick Open becomes a public search feature, add a shared `search.entries` operation over the in-memory read model.
- Do not imply full-text search until a real search backend exists.

Primary task:

- [[tasks/implement-quick-switcher-search]]

### 6. Packaging, Docs, And Smoke Validation

Make the release installable, explainable, and repeatable.

- Rebuild and embed WebApp assets for `forma serve`.
- Create or promote a committed example workspace for demos and smoke validation, excluding local-only state and legacy collection configuration.
- Document starter workspace creation, serving, and WebApp access.
- Add release smoke coverage for dashboard, documents, document detail, spaces, views, graph, and raw resource loading.
- Record known limitations, including read-only scope, no editor extensions, no AI Chat, and no write-capable proposal flow.

Primary task:

- [[tasks/stabilize-public-read-only-webapp-release]]

## Suggested Sequence

1. Stabilize the public read-only release boundary and RPC contract.
2. Finish reader quality and reference/context behavior.
3. Promote diagnostics into a read-only health surface.
4. Harden view renderers, especially graph.
5. Decide whether Quick Open remains dashboard-local or gains `search.entries`.
6. Prepare release docs, embedded assets, and smoke validation.
7. Revisit reviewable proposal flow only after the read-only release is stable.
8. Revisit VS Code and Zed extensions after WebApp and RPC contracts settle.

## Deferred Work

The following work remains intentionally outside the first public release:

- reviewable operation proposals;
- proposal persistence or apply behavior;
- metadata edit, move, rename, delete, or deprecate operations;
- AI Chat and Agent-provider integration;
- editor extensions;
- custom configured relation semantics;
- marker-based inline reference semantics;
- full-text, vector, or semantic search.

## Related Tasks

- [[tasks/stabilize-public-read-only-webapp-release]]
- [[tasks/expose-read-only-knowledge-health-in-webapp]]
- [[tasks/implement-interactive-graph-view-render]]
- [[tasks/implement-quick-switcher-search]]
- [[tasks/design-reviewable-operation-proposal-flow]]
- [[tasks/design-editor-extension-adapter-contract]]
