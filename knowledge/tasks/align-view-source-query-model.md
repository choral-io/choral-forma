---
scope: project
type: task
priority: P0
severity:
value: H
module: app

owners:
    - "[[members/Tiscs]]"
assignees:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - forma
    - p0
    - views
    - query

effort: M
readiness: ready
sprint:

blocked_by: []
related_to:
    - "[[tasks/implement-read-only-webapp]]"
    - "[[tasks/implement-view-entry-render]]"
    - "[[tasks/implement-starter-init-create-inspect-list]]"
    - "[[tasks/implement-check-index-diagnostics]]"

reported_by:
affected_area: View source, query model, starter views, and view rendering
---

# Align View Source Query Model

## Goal

Align P0 view indexing, starter generation, and rendering with the accepted
workspace-source and normalized-entry query model.

## Sources

- [[product/product-direction]]
- [[product/forma-p0-starter-spec]]
- [[architecture/forma-view-query-model]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-check-index-spec]]

## Context

The accepted product model treats the workspace as the base view data source.
`source` selects a candidate file set, while `query` filters normalized entry
records with explicit targets such as `entry.space` and
`frontmatter.status`. The direct `space` field remains a readable shortcut
for a workspace query filtered by `entry.space`.

Several completed P0 implementation slices still reflect the older
single-space-bound view model. `view.render` filters entries directly by
`definition.space`, kanban column queries use `field`, starter views emit
old query syntax, and view indexing currently requires every view to reference
a valid space. Those behaviors need a focused compatibility update before
the read-only WebApp builds on top of them.

## In Scope

- Update architecture specs so `view.render`, index view metadata, and
  diagnostics describe workspace-source views and normalized-entry queries.
- Parse view definitions that use `source.kind: workspace`, `source.include`,
  `source.exclude`, `query.all`, `query.any`, `query.not`, and explicit
  `target` predicates.
- Preserve `view.space` as shorthand for
  `target: entry.space`, `op: equals`, and the space id as value.
- Update starter view generation so kanban column queries use
  `target: frontmatter.status`.
- Allow graph views without a space filter to be indexed as valid page
  views.
- Update view rendering so table and kanban candidate selection evaluates the
  normalized-entry query model.
- Add focused tests for space shorthand, explicit workspace source,
  kanban target queries, invalid view diagnostics, and global graph view
  indexing.

## Out Of Scope

- Full-text search predicates.
- Reference graph rendering beyond validating and indexing graph view
  definitions.
- Runtime temporary filters, group-by controls, saved personal view controls,
  or advanced table features.
- Write-capable view mutations such as drag/drop.

## Acceptance Criteria

- Existing starter table and kanban views still render correctly through the
  space shorthand.
- Starter kanban column queries use `target: frontmatter.status` instead of
  `field: status`.
- A global graph view using `source.kind: workspace` and no space filter
  is accepted by view discovery and appears in index/view metadata.
- Invalid query targets or unsupported operations produce structured
  diagnostics instead of panics or silent misrendering.
- Focused Rust tests cover both shorthand and explicit workspace-source view
  definitions.

## Relationship Notes

This task blocks the read-only WebApp because the WebApp should not be built on
the older single-space-bound view model.

This task validates and indexes workspace-source graph views, but does not add
the global Graph View to `forma init` yet. Starter inclusion should happen when
the graph view rendering and WebApp navigation behavior are ready to expose it
as a user-facing page view.

## Open Questions

- None.
