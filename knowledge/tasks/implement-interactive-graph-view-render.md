---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - graph
    - views

effort: M
status: cancelled
readiness: needs-refinement
sprint:

blockedBy: []
relatedTo:
    - "decisions/editor-extension-primary-product-surface"
    - "design/editor-extension-mvp-design"
    - "planning/editor-extension-mvp-roadmap"
    - "tasks/implement-vscode-extension-mvp"
    - "planning/public-read-only-release-roadmap"
    - "tasks/align-view-source-query-model"
    - "tasks/implement-view-entry-render"
    - "tasks/implement-read-only-webapp"
    - "tasks/stabilize-public-read-only-webapp-release"

reportedBy:
affectedArea: Graph views
---

# Implement Interactive Graph View Render

> Cancelled as a WebApp-only hardening task. The stable graph data contract remains relevant; its active successor is the cross-Host implementation beginning with [[tasks/implement-shared-graph-view-runtime]].

## Goal

Stabilize graph view data and the first interactive WebApp graph renderer for the public read-only release.

## Sources

- [[architecture/forma-view-query-model]]
- [[discovery/mainstream-knowledge-app-feature-analysis]]
- [[tasks/align-view-source-query-model]]
- [[tasks/implement-view-entry-render]]
- [[tasks/implement-read-only-webapp]]
- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[planning/public-read-only-release-roadmap]]

## Context

The accepted view query model treats graph as a view mode rather than a global special feature. A graph view should use normal view navigation, tabs, or links, and should remain a query over workspace files instead of a separate product subsystem.

The current implementation already has the first baseline:

- `view.render` can return `graph` nodes and edges from configured view source and resolved index references.
- The WebApp renders graph views through Sigma.js.
- Graph nodes can navigate to indexed documents.
- Theme-aware graph colors and hover labels have a first-pass implementation.

The planned WebApp-only hardening is no longer the active product path. The current fixed-circle renderer is not the desired Graph baseline. The successor implementation reuses the `view.render` nodes and edges through one shared package consumed by the WebApp and editor extensions, with Host-specific theme, navigation, active-document, persistence, and lifecycle adapters.

## In Scope

- Review and stabilize the graph render result shape for `view.render` as a public read-only contract.
- Keep graph nodes and edges derived from existing workspace source/query semantics and graph edge configuration over resolved reference data.
- Support explicit graph edge configuration for body wikilinks, embeds, and structured field references, with optional user-facing labels for configured edges.
- Harden the WebApp graph surface for desktop and small-screen review.
- Validate node navigation, empty states, error states, theme switching, and long labels.
- Preserve graph as a normal view mode.
- Add or update tests for graph render data and invalid graph-view definitions when the contract changes.
- Update architecture or product knowledge if the graph render contract changes.

## Out Of Scope

- Advanced graph layout tuning or visual polish.
- Large-workspace graph performance optimization.
- Global graph outside the view system.
- Reference-aware query targets beyond the accepted view source/query model.
- Editable graph interactions.

## Acceptance Criteria

- A configured graph view can be opened through normal WebApp navigation.
- Graph render output contains enough node and edge data for the WebApp to display a meaningful minimal graph or graph-ready data surface.
- Graph view source/query behavior follows the existing view source query model.
- Graph edges are derived from configured graph edges over resolved references rather than ad hoc Markdown scanning in the WebApp.
- Body and field graph edges use configured or fallback labels rather than raw syntax intents or field names.
- Invalid graph definitions produce diagnostics rather than panics.
- The WebApp graph renderer remains readable in light and dark themes.
- Empty graph views and graph views with unresolved targets produce clear UI states.
- Focused Rust and Web checks pass for changed behavior.

## Relationship Notes

The completed graph query and render-result work remains valid. This WebApp-only hardening task stays cancelled. Cross-Host renderer requirements and implementation slices are now recorded in [[discovery/editor-graph-view-technical-research-2026-07-17]], [[tasks/design-editor-graph-view-renderer]], and [[tasks/implement-shared-graph-view-runtime]].

## Open Questions

- Should the first graph view include uncatalogued Markdown files by default when using `source.kind: workspace`?
