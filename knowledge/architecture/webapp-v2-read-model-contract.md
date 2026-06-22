---
scope: project
type: technical-design
owners:
    - "members/tiscs"
tags:
    - architecture
    - webapp
    - rpc
    - read-model
---

# WebApp V2 Read Model Contract

## Context

The WebApp V2 fake-data shell has stabilized enough to switch from renderer polish to real backend integration. The next implementation phase should make the Rust backend provide the read-only data needed by the GUI instead of continuing to grow WebApp-local mock projections. Product code should not carry a mock-data switch; demonstrations should run the backend against a real example workspace such as `examples/forma-starter-kit/`.

The WebApp remains a lightweight standalone knowledge browser. It should consume shared Forma operations and must not infer diagnostics, evaluate view queries, or duplicate reference resolution in the browser. Markdown rendering is a client concern for the WebApp reader, while Markdown analysis, read-model construction, diagnostics, and reference resolution remain backend concerns.

## Goals

- Provide the minimum read model needed to replace deterministic WebApp mock data.
- Keep repository Markdown and `.forma.yml`-included configuration as the source of truth.
- Keep WebApp rendering read-only until reviewable write operations are designed.
- Reuse existing operation semantics where possible: `files.list`, `file.render`, `file.references`, `check`, and `view.render`.
- Add aggregate read operations only when the GUI needs route-level data that is awkward or inefficient to compose in the browser.

## Non-Goals

- No write-capable WebApp operations in this phase.
- No AI Chat, ACP, proposal queue, or editor-extension integration.
- No browser-side workspace scanning, reference resolution, diagnostics, or query evaluation.
- No backend commitment to a specific graph layout or graph rendering library.
- No polished `list`, `table`, `kanban`, or `graph` renderer work beyond the minimum needed to show real operation output.

## WebApp Route Read Needs

### Workspace Shell

The shell needs one route-independent snapshot:

- workspace name and root display label;
- workspace status derived from diagnostics;
- configured taxonomies and terms needed for sidebar and route context;
- saved views with `id`, `path`, title, description, and renderer kind;
- global document count;
- workspace diagnostics summary;
- current mock user placeholder can remain client-local until Git identity is exposed intentionally.

This should be delivered by a backend aggregate instead of making the WebApp coordinate many low-level calls on initial load.

### Taxonomies And Terms

The current starter kit configures a primary taxonomy named `spaces`, but the WebApp read model should not require `spaces` as a hardcoded product concept. Routes and labels may still show "Spaces" for the starter when that taxonomy is configured.

The taxonomy route needs:

- list of configured taxonomies and terms that the WebApp chooses to surface;
- title, description, display order, page count, status, and updated label;
- pages belonging to the selected term.

`workspace.dashboard` is a WebApp-facing read model and should expose taxonomy summaries in the same terminology used by configuration. View summaries that target a configured taxonomy term should use the same taxonomy/term read-model shape as other routes.

### Pages

The `Pages` route needs:

- global page list across configured taxonomies;
- stable document id for routing;
- workspace path;
- title, summary, primary taxonomy term when available, kind/status fields when present, and updated label;
- available language variants for each canonical page, including language tags and variant route/raw paths, while keeping variants out of the primary page row set;
- render capability flags when a file cannot be rendered as a Markdown page.

The route should not depend on filesystem walking in the browser.

### Page Detail

The page route needs:

- metadata summary for the selected page;
- Markdown source for the selected page body;
- backend-derived heading outline, explicit references, backlinks, and diagnostics;
- optional source text only when source mode is explicitly supported;
- client-rendered Markdown body HTML or structured reader output.

For V2, relationships should include only explicit content-derived links. Configured frontmatter relations and custom marker semantics are deferred.

### Client Markdown Render Contract

For the WebApp reader, `file.render` should return the Markdown body source and backend-derived analysis results instead of making server-rendered HTML the primary contract. The backend owns frontmatter splitting, Markdown parsing for headings and references, diagnostics, and link resolution. The WebApp owns the final reader HTML so it can use browser-oriented Markdown libraries, theme-aware styling, Mermaid integration, and later reader plugins without changing Rust rendering code.

When the backend rewrites wikilinks or embeds into ordinary Markdown fallback links for client rendering, it must still preserve the original reference identity in structured read-model metadata. The client should not re-parse raw wikilink syntax or infer wikilink identity from rendered anchor text and `href` values. Future reader enhancements such as hover cards, backlink previews, or reference-specific styling should bind backend-provided reference metadata back onto rendered anchors during post-processing. This keeps syntax recognition and reference resolution in the Rust read model while letting the WebApp own presentation and interaction. Client-side enhanced reference rendering is deferred for now.

`file.render` should return a structured `headings` list for reader navigation. The WebApp may attach heading ids while rendering Markdown locally, but the outline order and heading identity should come from backend analysis rather than client-invented workspace scanning.

The WebApp should render Markdown through an isolated reader component. The renderer should prefer valid ordinary Markdown semantics and should sanitize generated HTML before insertion. It may borrow the pipeline shape used by Choral Flows: a `marked` renderer with explicit plugins for Mermaid, code highlighting, math, tables, and other reader features. Forma should not inherit Choral Flows' product-specific mention syntax, and it should not make DOM patching libraries part of the read-model contract.

Reader styling should live in WebApp CSS on a semantic container, similar to `tailwindcss-typography`, rather than large arbitrary-selector chains inside route components. Backend output and analysis should stay presentation-neutral.

Server-rendered HTML can remain a future compatibility or static-export output mode, but it is not the primary WebApp reader path.

### Views

The `Views` route needs:

- list of configured saved views;
- renderer kind aligned with product `view.mode`: `list`, `table`, `kanban`, or `graph`;
- title, description, source/query summary, and diagnostics for invalid views.

`View.kind` in the WebApp read model should be treated as a GUI-facing alias for the backend `view.mode`. `health` is not a View kind. Diagnostics and knowledge health remain separate product surfaces unless explicitly represented by a configured view file.

View detail can initially route by id and display existing `view.render` output for list, table, kanban, and graph. Graph output should stay library-agnostic: the backend returns neutral `nodes` and body-derived `edges`, while the WebApp chooses a lightweight read-only renderer.

The current WebApp may render `graph` output with Sigma.js to get pan, zoom, and hover interactions without making Sigma part of the RPC contract. Theme colors must be resolved on the client from CSS variables before being passed to the renderer, because WebGL renderers cannot be assumed to support all CSS color syntaxes such as `oklch(...)`. This conversion is presentation logic and should remain outside shared read-model types.

### Diagnostics

Diagnostics need both workspace-level and document-level access:

- workspace health summary;
- grouped diagnostics by severity, code, and path;
- document-specific diagnostics attached to selected document routes.
- structured diagnostic details when available: `location`, `actual`, and `expected`.

Diagnostics are operation results. They should not be persisted as a separate workspace data store unless a future cache contract is explicitly designed. The WebApp should render diagnostic details returned by the backend, not infer frontmatter fields, expected values, or source locations from diagnostic text. Document route operations such as `file.render` and `file.references` should report diagnostics scoped to the selected document path. Workspace-wide health and unrelated document diagnostics belong to aggregate operations such as `workspace.dashboard` or `check`.

## Proposed Operations

### Keep Existing Operations

Existing P0 operations remain useful and should be wired first where they match the route need:

- `files.list`: file navigation and global document candidates;
- `file.render`: document detail source and render analysis;
- `file.references`: outgoing links and backlinks;
- `view.render`: list, table, and kanban view detail;
- `check`: diagnostics and health state;
- `config.inspect`: workspace metadata and configured spaces.

The WebApp V2 shell has started consuming real operation output through its workspace client adapter. Fake data can remain as a fallback for visual review, but route implementations should prefer RPC-backed dashboard, document, reference, diagnostic, and view data whenever available.

### Add `workspace.dashboard`

Add a read-only aggregate operation for the WebApp shell and top-level dashboard:

```ts
type WorkspaceDashboardResult = BaseOperationResult & {
    operation: "workspace.dashboard";
    workspace: WorkspaceSummary;
    spaces: DashboardSpace[];
    documents: DashboardDocumentSummary[];
    views: DashboardViewSummary[];
    diagnostics: Diagnostic[];
};
```

This operation should be backed by the existing discovery/index pipeline and should not write files.

### Consider `document.read`

The WebApp can compose document detail from `file.render` and `file.references`, but a later `document.read` aggregate may reduce route-level round trips:

```ts
type DocumentReadResult = BaseOperationResult & {
    operation: "document.read";
    workspace: WorkspaceSummary;
    document: DashboardDocumentDetail;
};
```

Do not add this operation until `file.render` plus `file.references` proves too awkward for the WebApp adapter.

### Optional Server HTML Export

If server-rendered HTML becomes useful for static publishing, CLI preview, or non-browser clients, it should be treated as an explicit output mode rather than the WebApp reader's normal route. That mode should still avoid presentation-oriented classes and should not force the WebApp to give up its client renderer.

## Data Shape Guidelines

### Stable IDs

Routes need stable ids for documents, spaces, and views. The backend should derive ids deterministically:

- views: workspace-relative view config path without `.md`/`.mdx`, such as `.forma/views/tasks`;
- spaces: configured space id or future explicit space id;
- documents: path-derived slug or explicit index id.

The result should always include the canonical workspace path so users can still inspect the source file.

### Status

Backend read-model status should use the shared operation status vocabulary and be derived from diagnostics:

- `passed`: no relevant diagnostics;
- `warning`: one or more warnings or info-only diagnostic state that affects the surface;
- `failed`: one or more errors.

The WebApp may map `passed` to the UI label `healthy`, but the backend should expose enough diagnostic associations for the WebApp to avoid inventing status from local UI rules.

### References

Reference data should preserve:

- source path;
- target path;
- resolved target title when available;
- source kind (`body` or `frontmatter`);
- intent (`link`, `embed`, or `reference`);
- unresolved or external state where applicable.

The initial WebApp should display outgoing links and backlinks from explicit Markdown content. Frontmatter relation semantics are deferred.

### View Outputs

The read model should support these renderer kinds:

- `list`;
- `table`;
- `kanban`;
- `graph`.

`view.render` currently covers list, table, kanban, and graph. Graph output is intentionally a minimal data contract based on explicit body links, not a commitment to a specific client renderer such as Sigma.js, React Flow, Plotly, or Dagre. Frontmatter-defined relation graphs remain deferred until relation configuration is designed.

## Data Flow

```text
repository files
  -> forma-core discovery/index/analysis/reference operations
  -> forma-rpc JSON-RPC results
  -> packages/shared TypeScript contracts and client
  -> packages/webapp workspace client adapter
  -> client Markdown reader and route components
```

The WebApp should keep a package-local adapter boundary. Fake data can remain as a fallback adapter for design review, but production routes should consume shared operation results through `packages/shared`.

## Implementation Sequence

1. Add shared TypeScript types for the WebApp dashboard read model.
2. Add Rust structs and JSON-RPC dispatch for `workspace.dashboard`.
3. Implement the operation from existing workspace discovery, index entries, view discovery, and diagnostics.
4. Replace WebApp mock dashboard loading with a workspace client that calls the RPC endpoint.
5. Wire document detail to `file.render` and `file.references`.
6. Replace server-rendered document HTML consumption with a WebApp-local Markdown reader that uses backend-provided source, headings, references, and diagnostics.
7. Keep view detail renderers lightweight while graph interaction and layout choices remain outside the current `view.render` output contract.
8. Keep graph renderer implementation package-local and isolated from route orchestration so renderer choices can change without changing the read-model contract.

## Open Questions

- Should document ids stay path-derived slugs permanently, or should a future read-model API eventually expose explicit stable ids? Current direction: path-derived slugs.
- Should document heading ids eventually be embedded directly into server HTML output for export modes? Current direction: WebApp reader attaches ids from backend heading analysis during client render.
- Should `workspace.dashboard` include document bodies? Current direction: no.
- Should graph rendering use Sigma.js long-term? Current direction: Sigma.js is acceptable as the current WebApp renderer because it improves read-only graph interaction with modest dependency cost, but the backend and shared contract must remain renderer-agnostic.
- Should the first client renderer use `marked` or a React/unified component renderer? Current direction: use a `marked` pipeline close to Choral Flows for the first implementation, with DOMPurify sanitization and isolated WebApp CSS, then revisit if component-level rendering becomes necessary.

## Related Documents

- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-view-query-model]]
- [[design/webapp-v2-dashboard-design]]
