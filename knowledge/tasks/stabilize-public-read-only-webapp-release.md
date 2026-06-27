---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - release
    - webapp
    - readonly

effort: M
status: done
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "planning/public-read-only-release-roadmap"
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "tasks/expose-read-only-knowledge-health-in-webapp"
    - "tasks/implement-interactive-graph-view-render"
    - "tasks/implement-quick-switcher-search"

reportedBy:
affectedArea: Public read-only WebApp release
---

# Stabilize Public Read-only WebApp Release

## Goal

Prepare the current RPC-backed read-only WebApp for the first public Choral Forma release.

## Readiness Note

Promoted to Ready on 2026-06-24.

The next product slice should prioritize read-only WebApp stabilization instead of expanding write-capable operation design. This task is now the umbrella for validating the current read-only product boundary, coordinating health, graph, quick navigation, embedded asset, fixture, and smoke-test work without adding proposal, apply, AI Chat, or editor-extension scope.

## Sources

- [[planning/public-read-only-release-roadmap]]
- [[planning/webapp-primary-gui-roadmap]]
- [[design/webapp-v2-dashboard-design]]
- [[product/product-direction]]
- [[tasks/implement-webapp-v2-dashboard-shell]]

## Context

The WebApp V2 implementation has moved beyond a dashboard shell. It now has a working read-only route loop backed by Forma RPC, client-side Markdown rendering, document references, context panels, configured views, and a first-pass graph renderer.

The next release goal is not more feature expansion. The goal is to stabilize the public read-only product boundary, remove confusing placeholders, validate the current routes against real fixture workspaces, and document exactly what the first public release supports.

## In Scope

- Confirm the public read-only release boundary and known limitations.
- Stabilize the public RPC contract used by the WebApp for dashboard, documents, references, and views.
- Keep mock data out of the product fallback path and product WebApp bundle. Use a committed example workspace served by the backend for demos and design review.
- Review and harden loading, empty, error, and diagnostic states for primary routes.
- Validate Markdown reader behavior for ordinary repository Markdown, including tables, code blocks, images, links, headings, and long content.
- Validate desktop and small-screen behavior for the sidebar, route header, document context sheet, and reader.
- Rebuild embedded WebApp assets and verify `forma serve` can serve the public WebApp without a frontend dev server.
- Create or promote a committed example workspace for demos and smoke validation, with Spaces-only configuration, no local-only state, and no legacy collection files.
- Update README or release documentation for setup, starter workspace, serving, and current limitations.
- Run release smoke validation across dashboard, documents, spaces, views, graph, document detail, references, and raw resource loading.

## Out Of Scope

- Write-capable operations.
- Proposal Queue or apply behavior.
- AI Chat.
- VS Code or Zed extensions.
- Full-text search.
- Custom configured relations.
- Advanced graph analytics or large-workspace graph optimization.

## Acceptance Criteria

- The public read-only feature boundary is documented.
- The WebApp primary routes work against a real local fixture workspace through Forma RPC.
- RPC or workspace load failures show an explicit disconnected/error state rather than silently switching to mock data.
- The product WebApp code path does not include a mock data-source switch or product-side mock workspace client.
- The release has a committed example workspace or documented fixture path that can be served without relying on `.local` state, and it has no collection terminology/configuration residual.
- Document rendering supports ordinary Markdown fixtures without layout breakage on desktop or small screens.
- Document context shows overview, outgoing links, backlinks, diagnostics, and outline where applicable.
- Saved `list`, `table`, `kanban`, and `graph` views render useful read-only output or clear empty/error states.
- The WebApp no longer displays misleading proposal, AI Chat, or write-capable surfaces in the default public release path.
- `forma serve` can serve the built WebApp assets without a Vite dev server.
- Release smoke validation and project checks pass, or skipped checks are documented with reasons.

## Relationship Notes

This task is the release stabilization umbrella for the first public read-only release. It does not replace the dedicated health, graph, or quick navigation tasks; it coordinates their public-release boundary and validation.

## Validation Notes

- Confirmed the product WebApp data path uses Forma RPC only; product-side mock workspace client code has been removed.
- Promoted `examples/forma-starter-kit` as the committed example workspace for demos, smoke validation, and reader/view fixtures.
- Verified `cargo run -p forma-cli -- --workspace examples/forma-starter-kit check` passes.
- Verified `pnpm --filter @choral-forma/webapp build` rebuilds WebApp assets.
- Verified `forma serve` can serve the rebuilt embedded WebApp assets from `examples/forma-starter-kit` without a Vite dev server.

### 2026-06-24 Gap Audit

Commands and checks run:

- `cargo run -q -p forma-cli -- config inspect --json`: passed.
- `cargo run -q -p forma-cli -- workspace health --json`: passed.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`: passed.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json`: passed.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit workspace health --json`: passed.
- `pnpm --filter @choral-forma/webapp check`: passed.
- `pnpm --filter @choral-forma/webapp build`: passed with the existing Vite large-chunk warning from bundled Markdown/code-highlighting assets.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit serve --bind 127.0.0.1:4173`: passed after localhost binding approval.
- HTTP smoke against `http://127.0.0.1:4173`: root SPA route, document SPA route, `/rpc`, `/raw/assets/logo.svg`, and `/favicon.svg` returned expected successful responses.
- JSON-RPC smoke through `forma serve`: `workspace.dashboard`, `file.render`, `file.references`, `view.render` for kanban, and `view.render` for graph returned `passed` results.
- Browser smoke with Edge through Playwright: dashboard, `notes/markdown-reader`, graph view, and a `390px` wide document viewport rendered non-empty read-only UI without horizontal overflow.

Confirmed release boundary:

- The product WebApp still uses `RpcWorkspaceClient` only; there is no product-side mock workspace fallback.
- Localized starter pages are represented as canonical page `variants` and are not listed as independent primary entries.
- The starter fixture exercises notes, members, guidelines, tasks, language variants, raw assets, Markdown tables, code blocks, images, references, backlinks, kanban, and graph.
- The first public release can keep Quick Open as dashboard-local route, space, page, and view navigation. It should not be positioned as full-text search until a shared search operation exists.

Polish fixed during audit:

- Added an embedded WebApp favicon so public smoke runs do not produce a default `/favicon.ico` 404.
- Removed inactive account/action placeholder menu items from the sidebar user footer.
- Replaced an obsolete dashboard entry body fallback that referred to a future backend wiring step.

Remaining non-blocking follow-ups after the 2026-06-24 audit:

- The WebApp bundle still reports large chunks, primarily from Markdown/code-highlighting assets. This is not a read-only release blocker but should be revisited before wider distribution.
- The graph view is non-empty and navigable, but readability and interaction polish remain in [[tasks/implement-interactive-graph-view-render]].

### 2026-06-25 Final Smoke

Commands and checks run:

- `cargo run -q -p forma-cli -- config inspect --json`: passed.
- `cargo run -q -p forma-cli -- workspace health --json`: passed.
- `cargo run -q -p forma-cli -- tasks inspect knowledge/tasks/stabilize-public-read-only-webapp-release.md --json`: passed.
- `pnpm --filter @choral-forma/webapp check`: passed with the local pnpm version warning.
- `pnpm --filter @choral-forma/shared check`: passed with the local pnpm version warning.
- `pnpm exec vitest run packages/shared/src/index.test.ts`: passed.
- `pnpm --filter @choral-forma/webapp build`: passed with the existing Vite large-chunk warning.
- `cargo run -q -p forma-cli -- check --json`: passed.
- `cargo run -q -p forma-cli -- workspace health --json`: passed.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json`: passed.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit workspace health --json`: passed.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit serve --bind 127.0.0.1:4173`: passed for embedded WebApp serving.

HTTP and JSON-RPC smoke:

- `GET /`: returned the embedded WebApp HTML.
- `GET /pages/notes/getting-started`: returned the embedded WebApp HTML through SPA fallback.
- `GET /raw/assets/logo.svg`: returned the starter logo as `image/svg+xml`.
- `workspace.dashboard`: returned `passed`, canonical entries, language variants, spaces, and saved views.
- `workspace.health`: returned `passed` with no findings for the starter workspace.
- `view.render` for `.forma/views/graph`: returned `passed` with graph nodes and edges.
- `view.render` for `.forma/views/tasks`: returned `passed` with kanban columns and task cards.
- `file.render` and `file.references` for `notes/markdown-reader.md`: returned `passed` with rendered Markdown, headings, outgoing links, and backlinks.

Browser smoke with Edge through Playwright:

- Dashboard loaded non-empty content, displayed `Workspace Health`, and showed the no-findings empty state with no horizontal overflow.
- `notes/markdown-reader` rendered Markdown table, code, image text, and long content at `390px` width without horizontal overflow.
- Graph view rendered non-empty starter graph content and remained console-clean.
- Kanban view rendered task columns and cards and remained console-clean.
- Browser console had 0 errors and 0 warnings across the checked dashboard, document, graph, and kanban routes.

Release decision:

- The public read-only WebApp release boundary is validated for the current starter-kit-backed route and RPC surface.
- The product-side mock fallback remains removed.
- The completed [[tasks/expose-read-only-knowledge-health-in-webapp]] task resolves the previous diagnostics-surface follow-up for this release umbrella.
- Remaining graph interaction polish and shared search work are tracked separately and are not blockers for this read-only release stabilization task.
