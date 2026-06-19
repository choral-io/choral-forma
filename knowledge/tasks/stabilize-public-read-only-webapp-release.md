---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "members/Tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - release
    - webapp
    - readonly

effort: M
status: backlog
readiness: needs-refinement
sprint:

blocked_by: []
related_to:
    - "planning/public-read-only-release-roadmap"
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "tasks/expose-read-only-knowledge-health-in-webapp"
    - "tasks/implement-interactive-graph-view-render"
    - "tasks/implement-quick-switcher-search"

reported_by:
affected_area: Public read-only WebApp release
---

# Stabilize Public Read-only WebApp Release

## Goal

Prepare the current RPC-backed read-only WebApp for the first public Choral Forma release.

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

## Open Questions

- Should Quick Open remain dashboard-local for the first public release, or should it wait for a shared `search.entries` operation before being treated as a release feature?
