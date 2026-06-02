---
scope: project
type: ui-spec
owners:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - forma
    - webapp
    - gui
    - dashboard
    - design-system
sources:
    - "[[decisions/webapp-primary-gui-client]]"
    - "[[planning/webapp-primary-gui-roadmap]]"
    - "[[tasks/implement-webapp-v2-dashboard-shell]]"
    - "[[tasks/refactor-webapp-with-shadcn-base-ui]]"
---

# WebApp V2 Dashboard Design

## Purpose

Define the WebApp V2 product surface before replacing the current P0 validation
shell. V2 should feel like a Notion-style knowledge dashboard for a local
repository workspace, while keeping repository Markdown and shared Forma
operations as the source of truth.

The V2 design may start with fake data for visual and interaction review. The
prototype must keep a data adapter boundary so it can later switch from mock
workspace data to Forma RPC without rewriting the UI.

The WebApp is a lightweight standalone knowledge interface for browsing and
understanding repository-backed knowledge when editor integration is unavailable
or not in use. It is not the primary editing surface and should not become an
embedded Agent UI. Editor extensions and external Agent frameworks remain the
preferred surfaces for editing and Agent-assisted workflows after those
integrations exist.

## Design Direction

The WebApp should prioritize a calm, readable, document-centered dashboard
rather than an IDE clone. It should make the workspace feel inspectable at a
glance and let users move quickly between spaces, documents, views,
diagnostics, references, and future lightweight guided actions.

The primary mental model is:

```text
workspace dashboard -> space or view -> document/resource detail
                     -> diagnostics/health
```

The WebApp remains read-oriented. UI interactions that imply repository changes
may create proposed operations, dry-runs, or reviewable change previews, but
they must not silently mutate repository files.

## Scope Layers

V2 should be planned in three layers. The product should complete the read-only
layer first, while preserving the visible shape of lightweight interactions that
will be implemented later.

### L0 Read-Only Core

The first complete product loop is a read-only knowledge browser:

- workspace dashboard overview;
- spaces index;
- space detail;
- documents index;
- document detail or preview;
- views index;
- saved view detail;
- knowledge health and diagnostics;
- search results;
- source file references;
- route-aware breadcrumbs and metadata;
- empty, loading, and error states.

### L1 Lightweight Interaction Placeholders

Lightweight interaction affordances may appear during read-only implementation
when they clarify the final product shape, but they should stay read-only-safe
until backed by shared operations:

- quick open;
- search input and command entry;
- filter, sort, and view switch controls;
- expand and collapse sections;
- copy path and copy link;
- open source file or reveal in workspace;
- context panel actions.

These controls should either operate only on local UI state, open read-only
inspection surfaces, or clearly communicate that the operation is not available
yet.

### L2 Deferred Interactive Functions

The following work is deferred until the read-only browser is complete:

- proposal drafting;
- proposal review workflow;
- drag-and-drop board interactions;
- saved view customization;
- batch actions;
- AI-assisted explanation or drafting;
- any write-adjacent operation;
- editor or IDE integration handoff.

The current V2 shell should not include AI Chat. Chat can be reconsidered later
as an optional shell-level surface after read-only browsing and lightweight
interactions are stable.

Short-term scope also excludes ACP or similar Agent-client integrations. The
WebApp should first stabilize knowledge organization, reading, searching,
diagnostics, and lightweight local interactions. Future VS Code or Zed
extensions can provide a more seamless bridge from knowledge context into the
Agent capabilities already present in those editors.

## Primary Screens

### Workspace Home

The first screen should show the current workspace as a dashboard:

- workspace identity, status, and local service state;
- health summary and recent diagnostics;
- spaces with entry counts and representative metadata;
- pinned or recent documents;
- available views, including table, kanban, graph-ready, and future custom
  views;
- quick actions that lead to read-only inspection rather than direct writes.

This screen replaces the P0 validation overview as the user-facing entry point.

### Space Browser

Spaces should be shown as structured knowledge partitions, not raw folders. A
space page should include:

- title, include pattern, entry count, and health state;
- table/list view of entries;
- filters and sorting only when backed by shared operation data;
- entry cards or rows with title, summary, key fields, and path;
- links to relevant generated views.

### Document Detail

Document detail should keep reading at the center:

- rendered Markdown as the default view;
- source preview as a deliberate secondary view;
- metadata summary;
- backlinks and outgoing references;
- diagnostics attached to the document;
- resource preview for supported media files.

The document surface should not become a Markdown editor.

The right-side document panel should be route context, not a second body
column. For document routes it uses a compact tabbed structure:

- `Context`: overview fields, explicit references, backlinks, and diagnostics;
- `Outline`: the current document title plus heading navigation.

On smaller screens the context panel should become a sheet-style overlay
opened from route-header controls. The selected tab should remain global shell
state so users who prefer `Outline` can close and reopen the sheet without
losing context. On larger screens the panel remains docked and scrolls
independently from the document body.

The rendered Markdown body should be generated by a WebApp-local reader
renderer from backend-provided Markdown source and analysis data. The backend
should provide frontmatter splitting, heading outline, explicit references,
backlinks, and diagnostics; the WebApp should own HTML generation, sanitization,
Mermaid/code/math reader plugins, and theme-aware presentation.

The renderer should keep persisted content ordinary Markdown and should not
introduce product-specific inline syntax from Choral Flows. It may borrow the
Choral Flows implementation shape: a `marked` pipeline with explicit plugins
and DOMPurify sanitization. The reader surface should be styled through a
semantic container in WebApp CSS, similar to `tailwindcss-typography`, rather
than route-local arbitrary selector chains.

Document relationship surfaces should first expose only relationships that come
from explicit Markdown links:

- ordinary Markdown links, wikilinks, URLs, and path links produce outgoing
  links;
- backlinks are produced by reverse indexing explicit links from other
  documents.

The current WebApp V2 scope should present only link-derived route-context
sections:

- `Outgoing Links`: explicit links from the selected document;
- `Backlinks`: explicit links from other documents to the selected document.

Outgoing links should distinguish the first useful link resolution states without
requiring separate groups in the compact context panel:

- `Internal`: links that resolve to indexed workspace documents;
- `External`: absolute URL links that should remain normal links;
- `Unresolved`: workspace-relative paths or wikilinks that do not currently
  resolve to an indexed document.

Backlinks should remain reverse-indexed explicit links from other documents.
When backlink volume grows, the UI may add sorting, truncation, or a full
document-links footer, but the V2 context panel should stay compact.

Inline reference markers are intentionally deferred. Future support may allow
workspace configuration to assign meaning to leading markers such as `@`, `#`,
or `/` inside standard Markdown links. For example, a workspace could interpret
`[@Tiscs](members/Tiscs.md)` as a member inline reference or
`[#WebApp](concepts/webapp.md)` as a topic inline reference. This future feature
should keep persisted content valid in ordinary Markdown renderers and should
not require custom link destinations such as `member:Tiscs`.

Configured frontmatter relations are intentionally deferred. Future support may
come from explicit relation definitions in workspace configuration, but the
system should not hard-code business meanings for fields such as `depends_on`,
`blocked_by`, or `implements`. Those fields should become relations only when
configuration declares the relation id, label, source frontmatter field, target
resolver, cardinality, inverse behavior, and view/context visibility. Future
Views may use configured relations through templates or query configuration, but
relation semantics must remain data/configuration-driven.

### Views

Configured views should render as first-class pages. Product-level view
definitions use `view.mode`, while the WebApp read model may expose the same
renderer choice as `View.kind`. The stable renderer set should align with the
view query model:

- `list`: a lightweight ordered document or entry list;
- `table`: a structured field table;
- `kanban`: grouped cards over configured column queries;
- `graph`: a configured graph renderer over an explicit source/query scope.

`graph` is a normal configured view renderer, not a fixed Obsidian-style global
graph page. Diagnostics and health dashboards, search result pages, and future
proposal review surfaces should be modeled as separate product surfaces unless
they are explicitly backed by a configured view definition.

View rendering must come from shared Forma operations. The WebApp must not
re-implement Markdown scanning or query semantics in the browser.

The first graph renderer may use a lightweight client library for pan, zoom, and
hover feedback, but the design contract is still a read-only projection over
backend-provided nodes and explicit body-derived links. Graph colors should come
from existing theme tokens, with renderer-specific color conversion isolated in
the WebApp implementation. Labels should be readable by default, and hover
labels should use bounded, theme-aware presentation rather than library defaults
that can clash with dark mode.

### Diagnostics And Health

Diagnostics should move from raw lists toward an actionable health dashboard:

- workspace-level health summary;
- grouped findings by severity, path, and category;
- affected document navigation;
- explanation and future proposal actions.

Health data should still be read-only until reviewable operation proposals are
designed and implemented.

### Quick Open And Lightweight Search

V2 should keep one primary in-app discovery entry point:

- Quick Open is the default WebApp entry for jumping to known routes, spaces,
  views, and documents by title or path;
- lightweight search can be folded into Quick Open when it helps navigation;
- deeper full-text search should stay optional and does not need to compete with
  editor-native search or future editor extensions;
- command palette actions can be added later, after read-only navigation and
  reading flows are stable.

The route header should not expose a separate Search action unless it has a
clearer product role than Quick Open. Initial fake-data UI should avoid implying
that production-grade full-text indexing is already part of the WebApp scope.

### Deferred Proposal Surfaces

Proposal review is deferred and should not appear as a primary WebApp V2 route
or default context-panel section. Future proposal surfaces may include:

- proposal drawer or page for dry-run output and review;
- explicit transition from a lightweight action to a reviewable operation
  proposal.

These future surfaces should communicate that changes require review and
approval.

## Layout

Use a Notion-like dashboard layout:

- a compact workspace sidebar for spaces, documents, views, diagnostics, and
  user/workspace identity;
- a route header for breadcrumb or scope label, page title, and route-local
  controls;
- a main content column optimized for document and dashboard reading;
- optional right-side context panel for metadata, references, diagnostics, or
  route-specific signals;
- drawers/dialogs for command palette and focused lightweight workflows.

Avoid dense IDE-style chrome as the default. Advanced panels should appear when
they help the current task rather than permanently competing with reading.

## Component Boundaries

Generic visual UI primitives belong in `packages/webapp/src/components/ui` for
the first V2 implementation. Base UI wrappers or behavior-only helpers may live
under `packages/webapp/src/components/base` when useful. Components should move
to a shared UI package only after they stabilize and a second real UI consumer
needs them.

Expected WebApp V2 product component areas:

- `shell`: app frame, sidebar, topbar, command trigger, drawers;
- `dashboard`: workspace home, summary cards, activity and health blocks;
- `workspace`: space and view navigation;
- `document`: rendered/source/resource detail and document metadata;
- `references`: backlinks and outgoing reference surfaces;
- `diagnostics`: workspace and document health surfaces;

## Interaction States

Each major surface should define:

- loading state;
- empty state;
- warning and failed diagnostic states;
- disconnected RPC state;
- unavailable operation state;
- keyboard-visible focus state;
- read-only state for write-adjacent actions that are not yet in scope.

Fake-data prototypes may simulate these states before the real RPC adapter is
connected.

## Responsive Behavior

Desktop is the primary target for internal testing. The layout should still be
usable on smaller screens:

- sidebar can collapse into a drawer;
- right context panel can become a sheet;
- table-heavy views can degrade to stacked rows;
- command/search remains reachable from the top area.

## Accessibility Notes

V2 should use accessible primitives for focus management, dialogs, popovers,
menus, tabs, tooltips, and command/search interactions. Visual polish must not
come at the cost of keyboard navigation or readable focus states.

## Related Tasks

- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[tasks/refactor-webapp-with-shadcn-base-ui]]
- [[tasks/expose-read-only-knowledge-health-in-webapp]]
- [[tasks/implement-interactive-graph-view-render]]
- [[tasks/implement-quick-switcher-search]]
- [[tasks/design-reviewable-operation-proposal-flow]]
- [[tasks/design-ai-chat-interaction-model]]
