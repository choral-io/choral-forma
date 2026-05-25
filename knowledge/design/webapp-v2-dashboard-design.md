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

## Design Direction

The WebApp should prioritize a calm, readable, document-centered dashboard
rather than an IDE clone. It should make the workspace feel inspectable at a
glance and let users move quickly between collections, files, views,
diagnostics, references, and future assisted workflows.

The primary mental model is:

```text
workspace dashboard -> collection or view -> document/resource detail
                     -> diagnostics/health -> proposal/chat side surfaces
```

The WebApp remains read-oriented. UI interactions that imply repository changes
may create proposed operations, dry-runs, or reviewable change previews, but
they must not silently mutate repository files.

## Primary Screens

### Workspace Home

The first screen should show the current workspace as a dashboard:

- workspace identity, status, and local service state;
- health summary and recent diagnostics;
- collections with entry counts and representative metadata;
- pinned or recent documents;
- available views, including table, kanban, graph-ready, and future custom
  views;
- quick actions that lead to read-only inspection or proposal drafting rather
  than direct writes.

This screen replaces the P0 validation overview as the user-facing entry point.

### Collection Browser

Collections should be shown as structured spaces, not raw folders. A collection
page should include:

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

### Views

Configured views should render as first-class pages. P0 table and kanban
renderers are retained, but V2 should make room for:

- graph views;
- health views;
- search result views;
- proposal review views.

View rendering must come from shared Forma operations. The WebApp must not
re-implement Markdown scanning or query semantics in the browser.

### Diagnostics And Health

Diagnostics should move from raw lists toward an actionable health dashboard:

- workspace-level health summary;
- grouped findings by severity, path, and category;
- affected document navigation;
- explanation and future proposal actions.

Health data should still be read-only until reviewable operation proposals are
designed and implemented.

### Search And Command

V2 should reserve a command/search entry point for:

- quick open by title or path;
- search over indexed entries;
- command palette actions;
- future AI-assisted proposal drafting.

Initial fake-data UI can show the interaction shape before the backing search
operation is complete.

### Proposal And Chat Surfaces

Proposal review and AI Chat should be present as reserved product surfaces, not
as implemented write workflows in the first V2 shell:

- proposal drawer or page for dry-run output and review;
- chat drawer or side panel for explanation and guided maintenance;
- explicit transition from suggestion to reviewable operation proposal.

These surfaces should communicate that changes require review and approval.

## Layout

Use a Notion-like dashboard layout:

- a compact workspace sidebar for spaces, collections, views, diagnostics, and
  settings;
- a top command area for search, quick open, and workspace status;
- a main content column optimized for document and dashboard reading;
- optional right-side context panel for metadata, references, diagnostics, or
  chat;
- drawers/dialogs for proposals, command palette, and focused workflows.

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
- `workspace`: collection and view navigation;
- `document`: rendered/source/resource detail and document metadata;
- `references`: backlinks and outgoing reference surfaces;
- `diagnostics`: workspace and document health surfaces;
- `proposals`: future dry-run and review surfaces;
- `chat`: future assistant surfaces.

## Interaction States

Each major surface should define:

- loading state;
- empty state;
- warning and failed diagnostic states;
- disconnected RPC state;
- unavailable operation state;
- keyboard-visible focus state;
- read-only state and proposal-gated write-adjacent actions.

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
