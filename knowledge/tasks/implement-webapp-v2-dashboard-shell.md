---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "[[members/Tiscs]]"
assignees: []
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
shell using WebApp-local Tailwind CSS, shadcn/ui, Base UI, and deterministic
fake workspace data.

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
structure. It should use the P0 cutline as the code baseline, build a fake-data
dashboard for visual review, and keep a workspace client boundary so real Forma
RPC can be reconnected later.

## In Scope

- Keep `packages/shared` contract-only and on its existing `tsdown` build.
- Add Tailwind CSS, shadcn/ui, Base UI, and UI utilities to `packages/webapp`.
- Replace the P0 WebApp shell source with a V2 app structure.
- Add WebApp-local `components/ui`, optional `components/base`, `styles`,
  `data`, and feature directories.
- Implement a deterministic fake workspace client for dashboard review.
- Implement the first Notion-like workspace dashboard shell with sidebar,
  command/search placeholder, dashboard cards, collections, documents,
  diagnostics, proposal placeholder, and chat placeholder.
- Validate the UI in the in-app browser.

## Out Of Scope

- Reconnecting real RPC data.
- Adding write-capable operations.
- Implementing proposal apply behavior.
- Implementing AI Chat provider calls.
- Implementing VS Code or Zed extensions.
- Creating `@choral-forma/shared/ui` or `@choral-forma/shared/styles.css`.

## Acceptance Criteria

- `packages/shared` remains free of React, Tailwind, shadcn/ui, Base UI, and CSS
  dependencies.
- `packages/webapp` owns the V2 UI dependencies and app styles.
- The fake-data dashboard renders in the browser and is not blank.
- Dashboard layout includes workspace identity, collections, recent documents,
  diagnostics, proposal placeholder, and chat placeholder.
- The implementation preserves a clear workspace client interface for later RPC
  reconnection.
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
