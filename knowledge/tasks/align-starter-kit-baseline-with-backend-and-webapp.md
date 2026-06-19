---
scope: project
type: task
priority: P0
severity:
value: H
module: app

owners:
    - "members/Tiscs"
assignees:
    - "members/Tiscs"
reviewers: []
tags:
    - forma
    - p0
    - starter-kit
    - read-model
    - webapp

effort: L
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

- [[workspace/Tiscs/handoffs/forma-starter-kit-to-system-refactor]]
- [[product/forma-p0-starter-spec]]
- [[architecture/forma-view-query-model]]
- [[architecture/webapp-v2-read-model-contract]]
- [[decisions/use-settings-driven-taxonomy-and-navigation-model]]
- `examples/forma-starter-kit/`

## Context

The starter kit now demonstrates the intended first public configuration shape: `.forma.yml` is the root configuration entry, `.forma/` is only a conventional support directory, Markdown configuration nodes carry frontmatter configuration plus body render templates, and ordinary views use `source.type: pages` with taxonomy filters and `field` bindings.

Existing backend and WebApp implementation still lag behind that baseline in several places. Current code still contains older assumptions such as `.forma/settings.yml`, `.forma/types.yml`, `.forma/spaces.yml`, nested `view:` definitions, `source.kind: workspace`, `target: frontmatter.*`, and hardcoded space-oriented read-model contracts. Those compatibility paths should be removed from product-facing behavior instead of preserved as compatibility input, because no stable public config contract has shipped yet.

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
- Compatibility support for older unshipped config shapes, including `.forma/settings.yml`, `.forma/types.yml`, `.forma/spaces.yml`, nested `view:`, `source.kind`, and `target: frontmatter.*`.
- Route-level visual redesign outside data and contract alignment.

## Acceptance Criteria

- `forma check` succeeds against `examples/forma-starter-kit/` through the new `.forma.yml`-based loader.
- The backend no longer requires `.forma/settings.yml`, `.forma/types.yml`, or `.forma/spaces.yml` for the starter-kit baseline.
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

## Open Questions

- None.
