---
scope: project
type: technical-design
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - webapp
    - monorepo
    - ui
    - architecture
sources:
    - "decisions/webapp-primary-gui-client"
    - "planning/webapp-primary-gui-roadmap"
    - "design/webapp-v2-dashboard-design"
    - "architecture/forma-core-technical-direction"
---

# WebApp V2 Package Architecture

## Context

The repository currently has two TypeScript workspace packages:

- `packages/shared`: shared TypeScript contract types and RPC client code used by WebApp callers.
- `packages/webapp`: React/Vite WebApp served by `forma serve`.

Earlier V2 discussion considered making `packages/shared` also carry the role of a monorepo `packages/ui` package. That added avoidable CSS and dependency boundary complexity before there is a second real UI consumer.

`packages/shared` stays contract-only. `packages/webapp` carries the full `app/web` responsibility, including Tailwind CSS, DaisyUI, theme definitions, native browser interactions, and app-specific styles. The accepted foundation rewrite is recorded in [[planning/daisyui-webapp-foundation-rewrite-plan]].

## Goals

- Rebuild the WebApp as a Notion-style dashboard client.
- Keep the shared RPC and operation contracts available from the existing `@choral-forma/shared` root entry.
- Keep `packages/shared` free of React, Tailwind, DaisyUI, and CSS dependencies.
- Use Tailwind CSS 4 and DaisyUI 5 inside `packages/webapp`.
- Prefer semantic HTML and browser-owned interaction state over a WebApp component framework.
- Keep the WebApp connected to real Forma RPC operations through a package-local workspace client boundary.

## Non-goals

- Do not archive old source files in the repository; git history is the archive.
- Do not change Rust operation semantics during the UI reset.
- Do not make the WebApp a Markdown editor.
- Do not add a first-phase `@choral-forma/shared/ui` package or `@choral-forma/shared/styles.css` export.
- Do not use this foundation change to reverse [[decisions/editor-extension-primary-product-surface]].
- Do not promote WebApp components into a shared UI package before there is a second real UI consumer.
- Do not create a local DaisyUI wrapper library or recreate the removed generic UI directory.

## Proposed Package Shape

```text
packages/shared/
  src/
    index.ts
    rpc/

packages/webapp/
  src/
    app/
    data/
      workspace-client.ts
      rpc-workspace-client.ts
    features/
      dashboard/
      workspace/
      diagnostics/
    lib/
      utils.ts
    styles/
      globals.css
    main.tsx
```

The exact file list may change during implementation, but the package boundary should remain stable: shared contracts in `packages/shared`, WebApp UI and styles in `packages/webapp`.

## Package Entry Points

`@choral-forma/shared` is the only first-phase shared package entry:

```ts
import { FormaRpcClient, type FilesListResult } from "@choral-forma/shared";
```

The package root must not export React UI modules. A future `./ui` entry may be introduced only after WebApp components stabilize and another UI consumer, such as an editor WebView, needs shared implementation.

## Dependency Boundaries

`packages/shared` should keep a single non-UI dependency profile:

- TypeScript contract types;
- RPC client helpers;
- build dependencies required for packaging those TypeScript exports.

`tsdown` should remain responsible for the shared TypeScript contract build:

- `packages/shared/dist/index.mjs`
- `packages/shared/dist/index.d.mts`

Tailwind CSS, DaisyUI, and app-level CSS belong in `packages/webapp`. This avoids monorepo Tailwind source-scanning ambiguity and keeps the shared package from becoming a premature UI library.

Expected WebApp UI dependencies include:

- Tailwind CSS and its Vite integration;
- DaisyUI as a build-time Tailwind plugin owned by `packages/webapp`;
- React and React Router for rendered data and route coordination;
- small utility helpers such as `clsx` and `tailwind-merge` where feature code still demonstrates a use.

`@base-ui/react`, `class-variance-authority`, `shadcn`, and `tw-animate-css` are not part of the accepted WebApp foundation. A Headless dependency may be reconsidered only for a concrete browser-validation failure that cannot be addressed safely with a native primitive and feature-local code.

## UI And Interaction Boundaries

Route and domain components may remain when they express Forma behavior or product composition. Presentational markup should initially stay at its owning call site and use semantic HTML, DaisyUI classes, and Tailwind utilities directly.

The WebApp should not add generic `Button`, `Card`, `Drawer`, `Dropdown`, `Modal`, or `Tabs` wrappers merely to rename DaisyUI primitives. Reusable extraction is optional and happens only after the complete implementation passes automated and browser validation.

Interaction state ownership should follow this order:

1. native element state such as `<dialog>`, `<details>`, `<select>`, radio, or checkbox;
2. local imperative DOM coordination for focus, dismissal, and SPA navigation;
3. React state for rendered results, business data, persistence, or genuine cross-component coordination.

The accepted mobile navigation uses a native modal dialog because browser validation showed that the DaisyUI checkbox Drawer did not provide Escape dismissal or modal focus containment. Desktop navigation remains an ordinary responsive sidebar. Quick Open uses a separate native dialog, nested navigation groups use details/summary, reading width uses a native select, and Context/Outline uses radio-backed DaisyUI tabs.

## Data Flow

V2 should use a workspace client interface inside `packages/webapp`:

```text
WebApp feature component
-> workspace client interface
-> @choral-forma/shared RPC client
-> forma serve / RPC operations
```

This keeps the product WebApp path aligned with the public RPC contract. Design review and demos should use backend-served example workspaces rather than a product-side mock workspace client.

## Implemented Foundation

Current `packages/shared` and `packages/webapp` source files do not need an in-repository archive. They are recoverable from git history.

The accepted implementation:

1. Preserve the existing contract types and RPC client behavior in `@choral-forma/shared`.
2. Keep `packages/shared` on the current `tsdown` contract build.
3. Use Tailwind CSS, DaisyUI, semantic markup, and native browser primitives directly in `packages/webapp`.
4. Keep real RPC data behind `rpc-workspace-client` throughout the UI implementation.
5. Validate representative routes in Chromium and WebKit at desktop, tablet, and mobile widths.
6. Keep Graph rendering shared through `packages/graph-view` and WebApp-only theme mapping in the feature adapter.

## Operational Concerns

- `mise run check` remains the full validation gate.
- WebApp visual work should include browser smoke checks.
- `packages/webapp/dist` remains build output and should not become the source of truth for UI design.
- If dependency installation changes lockfiles, dependency changes should be committed intentionally with the UI architecture change.
- System light/dark behavior comes from the DaisyUI custom themes and `prefers-color-scheme`; no React theme provider or persisted manual selector is required for the first cut.

## Future Shared UI Extraction

If VS Code, Zed, or another WebView needs reusable UI, the project can introduce `@choral-forma/shared/ui` later. That extraction should be based on stable WebApp components and a real second consumer, not on first-pass speculation.

## Related Decisions

- [[decisions/webapp-primary-gui-client]]
- [[architecture/forma-core-technical-direction]]

## Related Tasks

- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[tasks/design-editor-extension-adapter-contract]]
