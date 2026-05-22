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

blocked_by: []
related_to:
    - "[[tasks/align-view-source-query-model]]"
    - "[[tasks/implement-view-entry-render]]"
    - "[[tasks/implement-read-only-webapp]]"

reported_by:
affected_area: Graph views
---

# Implement Interactive Graph View Render

## Goal

Implement an interactive graph view rendering path for workspace and filtered
view data.

## Sources

- [[architecture/forma-view-query-model]]
- [[discovery/mainstream-knowledge-app-feature-analysis]]
- [[tasks/align-view-source-query-model]]
- [[tasks/implement-view-entry-render]]
- [[tasks/implement-read-only-webapp]]

## Context

The accepted view query model treats graph as a view mode rather than a global
special feature. P0 already discovers and indexes graph views, but interactive
graph rendering is explicitly not guaranteed by the current scope. A graph
view should use normal view navigation, tabs, or links, and should remain a
query over workspace files instead of a separate product subsystem.

## In Scope

- Define the graph render result shape for view rendering.
- Render graph view data from existing workspace source/query semantics.
- Add a WebApp graph view surface or placeholder that can navigate graph nodes.
- Preserve graph as a normal view mode.
- Add tests for graph render data and invalid graph-view definitions.
- Update architecture or product knowledge if the graph render contract
  changes.

## Out Of Scope

- Advanced graph layout tuning.
- Large-workspace graph performance optimization.
- Global graph outside the view system.
- Reference-aware query targets beyond the accepted P0 model.
- Editable graph interactions.

## Acceptance Criteria

- A configured graph view can be opened through normal WebApp navigation.
- Graph render output contains enough node and edge data for the WebApp to
  display a meaningful graph or graph-ready data surface.
- Graph view source/query behavior follows the existing view source query
  model.
- Invalid graph definitions produce diagnostics rather than panics.
- Focused Rust and Web checks pass for changed behavior.

## Relationship Notes

This task builds on completed view query, view render, and WebApp work. It can
remain Backlog until the team decides graph rendering is the next best use of
WebApp effort.

## Open Questions

- Should graph rendering be implemented with a dependency, SVG/canvas, or a
  simple list-first graph-ready representation for the first pass?
- Should the first graph view include uncatalogued Markdown files by default
  when using `source.kind: workspace`?
