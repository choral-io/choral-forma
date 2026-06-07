---
scope: project
type: technical-design
owners:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - forma
    - webapp
    - monorepo
    - ui
    - architecture
sources:
    - "[[decisions/webapp-primary-gui-client]]"
    - "[[planning/webapp-primary-gui-roadmap]]"
    - "[[design/webapp-v2-dashboard-design]]"
    - "[[architecture/forma-core-technical-direction]]"
---

# WebApp V2 Package Architecture

## Context

The repository currently has two TypeScript workspace packages:

- `packages/shared`: shared TypeScript contract types and RPC client code used
  by WebApp callers.
- `packages/webapp`: React/Vite WebApp served by `forma serve`.

Earlier V2 discussion considered making `packages/shared` also carry the role
of a monorepo `packages/ui` package. That added avoidable CSS and dependency
boundary complexity before there is a second real UI consumer.

For the first WebApp V2 implementation, `packages/shared` stays contract-only.
`packages/webapp` carries the full `app/web` responsibility, including Tailwind
CSS, shadcn/ui generated components, Base UI usage, theme tokens, and
app-specific styles.

## Goals

- Rebuild the WebApp as a Notion-style dashboard client.
- Keep the shared RPC and operation contracts available from the existing
  `@choral-forma/shared` root entry.
- Keep `packages/shared` free of React, Tailwind, shadcn/ui, Base UI, and CSS
  dependencies during the first V2 implementation.
- Use Tailwind CSS, shadcn/ui, and Base UI inside `packages/webapp`.
- Allow fake-data UI prototyping before reconnecting the WebApp to real Forma
  RPC operations.

## Non-goals

- Do not archive old source files in the repository; git history is the archive.
- Do not change Rust operation semantics during the UI reset.
- Do not make the WebApp a Markdown editor.
- Do not add a first-phase `@choral-forma/shared/ui` package or
  `@choral-forma/shared/styles.css` export.
- Do not make editor extensions the primary GUI surface.
- Do not promote WebApp components into a shared UI package before there is a
  second real UI consumer.

## Proposed Package Shape

```text
packages/shared/
  src/
    index.ts
    rpc/

packages/webapp/
  src/
    app/
    components/
      ui/
      base/
    data/
      workspace-client.ts
      rpc-workspace-client.ts
    features/
      dashboard/
      workspace/
      document/
      diagnostics/
      references/
      proposals/
      chat/
    lib/
      utils.ts
    styles/
      globals.css
    main.tsx
```

The exact file list may change during implementation, but the package boundary
should remain stable: shared contracts in `packages/shared`, WebApp UI and
styles in `packages/webapp`.

## Package Entry Points

`@choral-forma/shared` is the only first-phase shared package entry:

```ts
import { FormaRpcClient, type FilesListResult } from "@choral-forma/shared";
```

The package root must not export React UI modules. A future `./ui` entry may be
introduced only after WebApp components stabilize and another UI consumer, such
as an editor WebView, needs shared implementation.

## Dependency Boundaries

`packages/shared` should keep a single non-UI dependency profile:

- TypeScript contract types;
- RPC client helpers;
- build dependencies required for packaging those TypeScript exports.

`tsdown` should remain responsible for the shared TypeScript contract build:

- `packages/shared/dist/index.mjs`
- `packages/shared/dist/index.d.mts`

Tailwind CSS, shadcn/ui, Base UI, and app-level CSS belong in
`packages/webapp` for the first V2 implementation. This avoids monorepo
Tailwind source-scanning ambiguity and keeps the shared package from becoming a
premature UI library.

Expected WebApp UI dependencies include:

- Tailwind CSS and its Vite integration;
- shadcn/ui generated component source inside
  `packages/webapp/src/components/ui`;
- Base UI used directly by WebApp components or thin wrappers under
  `packages/webapp/src/components/base`;
- utility helpers such as `class-variance-authority`, `clsx`, and
  `tailwind-merge`.

## Data Flow

V2 should use a workspace client interface inside `packages/webapp`:

```text
WebApp feature component
-> workspace client interface
-> @choral-forma/shared RPC client
-> forma serve / RPC operations
```

This keeps the product WebApp path aligned with the public RPC contract. Design
review and demos should use backend-served example workspaces rather than a
product-side mock workspace client.

## Reinitialization Strategy

Current `packages/shared` and `packages/webapp` source files do not need an
in-repository archive. They are recoverable from git history.

Implementation should:

1. Preserve the existing contract types and RPC client behavior in
   `@choral-forma/shared`.
2. Keep `packages/shared` on the current `tsdown` contract build.
3. Add Tailwind CSS, shadcn/ui, Base UI, and visual components in
   `packages/webapp`.
4. Replace the current WebApp shell source with a V2 fake-data app.
5. Validate the UI in the in-app browser before reconnecting real RPC data.
6. Reconnect RPC through `rpc-workspace-client` only after the V2 layout and
   component architecture are accepted.

## Operational Concerns

- `mise run check` remains the full validation gate.
- WebApp visual work should include browser smoke checks.
- `packages/webapp/dist` remains build output and should not become the source
  of truth for UI design.
- If dependency installation changes lockfiles, dependency changes should be
  committed intentionally with the UI architecture change.

## Future Shared UI Extraction

If VS Code, Zed, or another WebView needs reusable UI, the project can introduce
`@choral-forma/shared/ui` later. That extraction should be based on stable
WebApp components and a real second consumer, not on first-pass speculation.

## Related Decisions

- [[decisions/webapp-primary-gui-client]]
- [[architecture/forma-core-technical-direction]]

## Related Tasks

- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[tasks/refactor-webapp-with-shadcn-base-ui]]
- [[tasks/design-editor-extension-adapter-contract]]
