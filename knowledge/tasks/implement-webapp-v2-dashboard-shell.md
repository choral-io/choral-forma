---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "[[members/Tiscs]]"
assignees:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - forma
    - p1
    - webapp
    - dashboard
    - ui

effort: L
readiness: ready
sprint:

blocked_by: []
related_to:
    - "[[decisions/webapp-primary-gui-client]]"
    - "[[design/webapp-v2-dashboard-design]]"
    - "[[architecture/webapp-v2-package-architecture]]"
    - "[[planning/webapp-primary-gui-roadmap]]"
    - "[[tasks/refactor-webapp-with-shadcn-base-ui]]"

reported_by:
affected_area: WebApp V2 dashboard shell
---

# Implement WebApp V2 Dashboard Shell

## Goal

Reinitialize the WebApp from the P0 cutline into a Notion-like V2 dashboard
shell using WebApp-local Tailwind CSS, shadcn/ui, Base UI, and the read-only
Forma workspace model.

## Sources

- [[decisions/webapp-primary-gui-client]]
- [[design/webapp-v2-dashboard-design]]
- [[architecture/webapp-v2-package-architecture]]
- [[planning/webapp-primary-gui-roadmap]]

## Context

The current P0 WebApp is a validation shell. The V2 direction keeps
`packages/shared` as a contract/RPC package and places Tailwind CSS, shadcn/ui,
Base UI, visual primitives, theme tokens, and app-specific styles inside
`packages/webapp`.

The first implementation should not preserve the old WebApp component
structure. It should use the P0 cutline as the code baseline, build a dashboard
for visual review, and keep a workspace client boundary so Forma RPC can feed
the UI without making route components own backend operation details.

During implementation, the task expanded from a fake-data design shell into the
first RPC-backed read-only WebApp loop. This expansion is intentional: the
sidebar, route shell, document reader, context panel, and view routes needed real
workspace data to validate the product shape.

## In Scope

- Keep `packages/shared` contract-only and on its existing `tsdown` build.
- Add Tailwind CSS, shadcn/ui, Base UI, and UI utilities to `packages/webapp`.
- Replace the P0 WebApp shell source with a V2 app structure.
- Add WebApp-local `components/ui`, optional `components/base`, `styles`,
  `data`, and feature directories.
- Implement a workspace client boundary with deterministic fallback data for
  dashboard review.
- Implement the first Notion-like workspace dashboard shell with sidebar,
  command/search placeholder, dashboard cards, spaces, documents, diagnostics,
  and views.
- Connect the primary read-only routes to available Forma RPC operations.
- Implement the document context and outline panel, including small-screen sheet
  behavior.
- Implement lightweight `list`, `table`, `kanban`, and `graph` view renderers.
- Validate the UI in the in-app browser.

## Out Of Scope

- Adding write-capable operations.
- Implementing proposal apply behavior.
- Implementing AI Chat provider calls.
- Implementing proposal queue UI.
- Implementing VS Code or Zed extensions.
- Creating `@choral-forma/shared/ui` or `@choral-forma/shared/styles.css`.
- Polishing every saved view renderer beyond the first read-only pass.

## Acceptance Criteria

- `packages/shared` remains free of React, Tailwind, shadcn/ui, Base UI, and CSS
  dependencies.
- `packages/webapp` owns the V2 UI dependencies and app styles.
- The WebApp dashboard renders in the browser and is not blank.
- Dashboard layout includes workspace identity, spaces, recent documents,
  diagnostics, documents, and views.
- The implementation preserves a clear workspace client interface for later RPC
  evolution.
- Document detail displays rendered Markdown, metadata, body-derived outgoing
  links, backlinks, diagnostics, and heading outline.
- Small-screen document context is available from a sheet and does not fall below
  the document body.
- Saved views route through read-only list, table, kanban, and graph renderer
  placeholders or first-pass implementations.
- `pnpm --filter @choral-forma/webapp check` passes.
- `pnpm --filter @choral-forma/webapp build` passes.
- `mise run check` passes before the task is considered review-ready.

## Relationship Notes

This task replaces the earlier narrower GUI foundation refactor path. The old
P0 validation shell remains recoverable from git history and should be used only
as behavioral reference, not as the V2 component structure.

## Validation Notes

- Implemented `packages/webapp` as a WebApp-local Tailwind CSS, shadcn/ui, and
  Base UI dashboard shell with deterministic fake workspace data.
- Kept `packages/shared` contract-only on its existing `tsdown` build.
- Used `@base-ui/react` rather than the retired `@base-ui-components/react`
  package.
- Verified the local Vite preview through the in-app browser at
  `http://127.0.0.1:5174/`; the dashboard rendered and browser console error
  logs were empty.
- Fresh validation:
    - `pnpm --filter @choral-forma/webapp check`
    - `pnpm --filter @choral-forma/webapp build`
    - `pnpm --filter @choral-forma/shared check`
    - `pnpm --filter @choral-forma/shared build`

## Review Notes

- Reworked the shell into the current read-only WebApp direction: route-aware
  sidebar, dashboard, spaces, documents, document reader, context panel, outline
  panel, and saved views.
- Connected the WebApp through the workspace client adapter to real Forma RPC
  data for the primary read-only routes, while keeping deterministic fallback
  behavior for design review.
- Deferred proposal queue and AI Chat surfaces to keep the WebApp focused on a
  lightweight knowledge reader.
- Added mobile document context behavior through a sheet and kept the selected
  `Context` or `Outline` tab as global shell state.
- Added a first Sigma.js graph renderer for `graph` views, isolated in the
  WebApp feature layer so the shared read model remains renderer-agnostic.
- Fixed graph label and hover rendering to use theme-aware colors and updated
  theme synchronization so CSS-token consumers respond when switching light and
  dark modes.
- Switched document body rendering to a WebApp-local Markdown reader backed by
  backend-provided Markdown source, heading analysis, references, and
  diagnostics.
- Added Shiki code highlighting with theme-aware light and dark output, reader
  CSS for common Markdown semantics, raw workspace image loading through the
  existing `/raw` route, and a local Markdown rendering fixture for browser
  review.
- Recorded the reference identity boundary: backend analysis must preserve
  wikilink/embed identity in structured metadata for future hover cards or
  reference-specific rendering, while the WebApp should not re-parse raw
  wikilink syntax.
- Aligned the root package manager declaration with the local toolchain by
  updating `packageManager` to `pnpm@11.5.0`; `pnpm@11.4.0` could not be
  resolved by Corepack in the current environment.
- Verified HTTP smoke routes on the hosted dev server:
    - `/`
    - `/documents`
    - `/spaces`
    - `/views`
    - `/views/knowledge-graph`
- Verified:
    - `pnpm --filter @choral-forma/webapp lint`
    - `pnpm --filter @choral-forma/webapp check`
    - `pnpm exec vitest run packages/webapp/src/lib/workspace-links.test.ts`
    - `mise run check`
- Latest full validation:
    - `mise run check`
- Residual review item: Vite reports a chunk-size warning after adding the graph
  renderer and client-side syntax highlighting. This is not blocking for review,
  but graph rendering and Shiki loading are good candidates for later route-level
  lazy loading if bundle size becomes a release gate.
