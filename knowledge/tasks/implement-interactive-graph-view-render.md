---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - graph
    - views

effort: M
readiness: needs-refinement
sprint:

blocked_by:
    - "[[tasks/implement-reference-navigation-baseline]]"
related_to:
    - "[[tasks/align-view-source-query-model]]"
    - "[[tasks/implement-view-entry-render]]"
    - "[[tasks/implement-read-only-webapp]]"

reported_by:
affected_area: Graph views
---

# Implement Interactive Graph View Render

## Goal

Implement graph view data and a minimal validation render for workspace and
filtered view data.

## Sources

- [[architecture/forma-view-query-model]]
- [[discovery/mainstream-knowledge-app-feature-analysis]]
- [[tasks/align-view-source-query-model]]
- [[tasks/implement-view-entry-render]]
- [[tasks/implement-read-only-webapp]]

## Context

The accepted view query model treats graph as a view mode rather than a global
special feature. P0 already discovers and indexes graph views, but graph
rendering is explicitly not guaranteed by the current scope. A graph view
should use normal view navigation, tabs, or links, and should remain a query
over workspace files instead of a separate product subsystem.

The current WebApp is a validation shell and is expected to be rebuilt in a
later UI phase. This task should prioritize the graph data contract and minimal
function verification over polished graph UI.

## In Scope

- Define the graph render result shape for `view.render`.
- Render graph nodes and edges from existing workspace source/query semantics
  and resolved index reference data.
- Add a minimal WebApp graph surface or graph-ready data surface that can
  validate node navigation.
- Preserve graph as a normal view mode.
- Add tests for graph render data and invalid graph-view definitions.
- Update architecture or product knowledge if the graph render contract
  changes.

## Out Of Scope

- Advanced graph layout tuning or visual polish.
- Large-workspace graph performance optimization.
- Global graph outside the view system.
- Reference-aware query targets beyond the accepted view source/query model.
- Editable graph interactions.

## Acceptance Criteria

- A configured graph view can be opened through normal WebApp navigation.
- Graph render output contains enough node and edge data for the WebApp to
  display a meaningful minimal graph or graph-ready data surface.
- Graph view source/query behavior follows the existing view source query
  model.
- Graph edges are derived from resolved index references rather than ad hoc
  Markdown scanning in the WebApp.
- Invalid graph definitions produce diagnostics rather than panics.
- Focused Rust and Web checks pass for changed behavior.

## Relationship Notes

This task builds on completed view query, view render, WebApp work, and the
reference navigation baseline. It can remain Backlog until reference navigation
is available.

## Open Questions

- Should graph rendering be implemented with a dependency, SVG/canvas, or a
  simple list-first graph-ready representation for the first pass?
- Should the first graph view include uncatalogued Markdown files by default
  when using `source.kind: workspace`?
