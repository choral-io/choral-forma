---
scope: project
type: task
priority: P0
severity:
value: M
module: app

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - p0
    - webapp

effort: L
status: done
readiness: ready
sprint:

blocked_by:
    - "tasks/implement-operation-rpc-cli-foundation"
    - "tasks/implement-starter-init-create-inspect-list"
    - "tasks/implement-view-entry-render"
    - "tasks/align-view-source-query-model"
related_to:
    - "architecture/forma-p0-operation-api-spec"
    - "decisions/forma-p0-core-architecture"

reported_by:
affected_area: Local read-only Forma WebApp
---

# Implement Read Only WebApp

## Goal

Implement the P0 local read-only WebApp served by `forma serve`.

## Sources

- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-p0-operation-api-spec]]
- [[product/forma-p0-starter-spec]]

## Context

The P0 GUI is a local browser WebApp backed by `POST /rpc`. It should provide basic browsing and rendering, but no editing or mutation.

## In Scope

- Implement WebApp shell in `packages/webapp`.
- Implement shared RPC client/types/utilities in `packages/shared`.
- Show workspace overview from composed operations.
- Show spaces, entry lists, entry inspection/rendering, page views, check diagnostics, and index status.
- Serve built static assets from `forma serve` in release mode.
- Add frontend type/build checks and minimal integration tests where practical.

## Out Of Scope

- Editing, create forms, drag/drop, or configuration mutation in the GUI.
- Desktop or mobile clients.
- VS Code or Zed extensions.
- MCP integration.

## Acceptance Criteria

- `forma serve` starts a localhost server and serves the WebApp.
- The WebApp uses RPC operations instead of direct file reads.
- Starter workspace spaces and views are browsable.
- Diagnostics and stale-index state are visible without being persisted.
- Frontend build/type checks pass in CI.

## Relationship Notes

Previously blocked by operation/RPC, starter CLI flows, render operations, and the follow-up view source/query model alignment. Those blockers are now resolved by completed delivery tasks. The `blocked_by` entries remain as dependency history and downstream-unlock evidence.

## Implementation Notes

- Added embedded WebApp asset serving to `forma serve` with `POST /rpc` kept as the only product operation endpoint.
- Added `forma serve --webapp-dir <dir>` as a P0 serve-time development override for testing external WebApp assets without changing workspace configuration.
- Added `forma serve --cors-origin <origin>` and `VITE_FORMA_RPC_URL` support so a Vite dev server can hot-reload the WebApp while calling Forma RPC explicitly across origins.
- Added a Rust build fallback so `forma-cli` can compile from a clean checkout even when ignored WebApp `dist` assets have not been built yet.
- Added read-only `config.inspect` and `files.list` RPC surfaces for configuration inspection and file navigation.
- Limited path-scoped `config.inspect` to known configuration source files so it does not become a general workspace file read API.
- Implemented the shared TypeScript RPC client and initial read-only React WebApp shell for overview, structured navigation, file navigation, entry rendering, view rendering, diagnostics, inspector, and relationship panels.
- `files.list` supports file navigation without making file browsing the primary product navigation surface.

## Review Evidence

- `cargo fmt --all -- --check`
- `cargo test --workspace`
- `cargo test -p forma-cli rpc_router`
- `./node_modules/.bin/tsc --noEmit -p packages/shared/tsconfig.json`
- `./node_modules/.bin/tsc --noEmit -p packages/webapp/tsconfig.json`
- `./node_modules/.bin/tsdown src/index.ts --format esm --dts --clean --out-dir dist` from `packages/shared`
- `./node_modules/.bin/vite build` from `packages/webapp`
- `./node_modules/.bin/prettier --check "knowledge/**/*.{md,mdx,md.tpl,mdx.tpl}" --no-error-on-unmatched-pattern --log-level warn`
- `git diff --check`
- Temporary no-`packages/webapp/dist` check: `cargo test -p forma-cli rpc_router_serves_embedded_webapp_assets`
- Manual browser verification against a temporary starter workspace served from `forma serve --bind 127.0.0.1:3877`: overview loaded through RPC and `notes/project.md` opened through `file.render`.
- `mise run check` was attempted but blocked by environment or supply-chain policy checks outside this task's scope, so equivalent project checks were run directly where practical.

## Open Questions

- Component library and styling details can be chosen during implementation.
