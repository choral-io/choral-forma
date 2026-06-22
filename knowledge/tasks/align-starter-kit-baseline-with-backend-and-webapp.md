---
scope: project
type: task
priority: P0
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - p0
    - starter-kit
    - read-model
    - webapp

effort: L
status: done
readiness: ready
sprint:

blocked_by: []
related_to:
    - "product/forma-p0-starter-spec"
    - "architecture/forma-view-query-model"
    - "architecture/webapp-v2-read-model-contract"
    - "decisions/use-settings-driven-taxonomy-and-navigation-model"
    - "tasks/stabilize-public-read-only-webapp-release"

reported_by:
affected_area: Starter-kit configuration, backend read model, shared RPC contracts, WebApp routes
---

# Align Starter Kit Baseline With Backend And WebApp

## Goal

Align the backend configuration loader, read model, shared TypeScript contracts, and WebApp route data with `examples/forma-starter-kit/` as the baseline.

## Sources

- [[workspace/tiscs/handoffs/forma-starter-kit-to-system-refactor]]
- [[product/forma-p0-starter-spec]]
- [[architecture/forma-view-query-model]]
- [[architecture/webapp-v2-read-model-contract]]
- [[decisions/use-settings-driven-taxonomy-and-navigation-model]]
- `examples/forma-starter-kit/`

## Context

The starter kit demonstrates the intended first public configuration shape: `.forma.yml` is the root configuration entry, `.forma/` is only a conventional support directory, Markdown configuration nodes carry frontmatter configuration plus body render templates, and ordinary views use `source.type: pages` with taxonomy filters and `field` bindings.

The backend and WebApp should stay aligned with that baseline without preserving compatibility paths for earlier unshipped config shapes. No stable public config contract has shipped yet, so stale assumptions should be removed from product-facing behavior rather than retained as aliases.

This task should preserve the current user-facing "Spaces" experience for the starter as a configured taxonomy projection. It should not freeze the current `fields.*`, `source.*`, and taxonomy binding paths as the final runtime object model.

## In Scope

- Load `.forma.yml` as the main workspace configuration entry.
- Resolve `.forma.yml` `include` patterns for committed Markdown configuration nodes and local extension points.
- Parse Markdown configuration node frontmatter for dashboard, taxonomy, term, view, and template-adjacent configuration.
- Project the starter `spaces` taxonomy into the current backend compatibility surface until the final runtime object model is designed.
- Discover pages from configured taxonomy term include patterns.
- Discover and render top-level starter view definitions using `source.type: pages`, taxonomy map-to-list filters, `field: fields.*` predicates, table column objects, view-level sort, and kanban column sort.
- Expose table column labels from starter column objects in read-model output while keeping field ids stable for routing, sorting, and formatting.
- Update shared TypeScript contracts and WebApp mapping code away from `source.kind` toward `source.type`.
- Keep the WebApp's visible starter "Spaces" route behavior stable while deriving it from configured taxonomy data.
- Remove legacy starter/config/view assumptions instead of preserving compatibility for old unshipped shapes.
- Update starter generation, operation fixtures, and tests so product behavior validates against `examples/forma-starter-kit/`.
- Validate backend, shared package, WebApp, and full project checks where practical.

## Out Of Scope

- Final runtime object model design beyond the compatibility projection needed for the starter baseline.
- Write-capable WebApp operations.
- Proposal queue, AI Chat, VS Code extension, or Zed extension work.
- Full-text search or advanced query operators beyond the current P0 view model.
- Compatibility support for older unshipped config and view shapes.
- Route-level visual redesign outside data and contract alignment.

## Acceptance Criteria

- `forma check` succeeds against `examples/forma-starter-kit/` through the new `.forma.yml`-based loader.
- The backend uses the `.forma.yml` include-driven starter-kit baseline without requiring separate registry files.
- Legacy starter/config/view shapes are removed from product-facing starter generation, operation fixtures, shared contracts, and WebApp mapping code.
- Starter taxonomy terms are discovered as page classification inputs without treating `spaces` as a built-in product primitive.
- Starter views under `examples/forma-starter-kit/.forma/views/*.md` are discovered from top-level Markdown frontmatter.
- `source.type: pages` and taxonomy filters are accepted for list, table, kanban, and graph views.
- Query predicates and display bindings use `field` paths such as `fields.status` instead of `target: frontmatter.status` in starter-facing behavior.
- Table column objects expose both stable field ids and labels in current read-model output, and kanban column sort definitions from the starter kit are parsed and applied or safely normalized.
- Shared TypeScript contracts and WebApp RPC mapping use the updated read-model shape without a product-facing `source.kind` contract.
- WebApp primary routes continue to work against the starter kit through Forma RPC.
- Focused Rust and TypeScript checks pass, and `mise run check` passes or any skipped check is documented with the exact reason.

## Relationship Notes

This task follows the starter-kit handoff and narrows work that is too specific for the broader public read-only release stabilization umbrella.

It is related to the completed view-source/query alignment work, but it should not reopen that task. The older task captured a previous transition path; this task aligns the implementation with the newer settings-driven starter-kit baseline.

## Implementation Notes

- Removed the backend view-query compatibility path that accepted legacy `target` predicates. View query predicates now use the starter-facing `field` key only, and a regression test covers rejection of `target: fields.status`.
- Reworked `examples/forma-starter-kit/` into the six-space baseline: notes, tasks, members, decisions, proposals, and guidelines. Removed legacy unshipped `todos` and `users` starter assumptions from the example, generator, fixtures, and tests.
- Added `knowledge/test-cases/forma-starter-kit/` as a project-level evaluation suite so pressure tests and gate cases stay outside the copyable starter workspace.
- Removed the earlier shared-profile path example from the starter baseline. Future profile fragments, if introduced, should be selected by explicit workspace-relative references rather than any built-in profile directory.

## Review Evidence

- `mise run check` passed.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit knowledge health --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- check --json` passed for the project workspace.
- `git diff --check` passed.
- Project `knowledge health` still reports 8 existing warning-level graph/connectivity findings outside the starter-kit change scope.

## Open Questions

- None.
