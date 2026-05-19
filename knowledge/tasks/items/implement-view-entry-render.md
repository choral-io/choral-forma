---
scope: project
type: task
owners:
  - "[[groups/default-team]]"
assignees: []
reviewers:
  - "[[groups/default-team]]"
tags:
  - forma
  - p0
  - rendering
  - views
priority: P0
severity:
value: H
module: app
effort: L
readiness: ready
sprint:
blocked_by: []
related_to:
  - "[[architecture/forma-p0-operation-api-spec]]"
  - "[[product/forma-p0-starter-spec]]"
reported_by:
affected_area: Entry rendering and declarative views
---

# Implement View Entry Render

## Goal

Implement P0 read-only render operations for Markdown entries and declarative
page views.

## Sources

- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-core-technical-direction]]
- [[product/forma-p0-starter-spec]]

## Context

The P0 WebApp should read through operations, not directly from files. Entry
rendering and view rendering are separate operation surfaces so inspection can
stay metadata-focused.

## In Scope

- Implement `entry.render` with `format: "html"` for WebApp use.
- Implement `view.render` for P0 page views.
- Render table views from collection entries, columns, and sort definitions.
- Render kanban views from collection entries and column `query.all` filters.
- Support `<!-- forma-view -->` as the view mount point.
- Render Obsidian-style embeds as links or placeholders, not expanded content.
- Add golden tests for table, kanban, entry HTML, missing mount points, invalid
  view fields, and unresolved references.

## Out Of Scope

- Markdown export as a primary render pipeline.
- Embedded views.
- Transclusion expansion.
- Drag/drop mutation or `onDrop`.
- Rich Markdown editing.

## Acceptance Criteria

- `entry.render` and `view.render` return stable JSON result shapes.
- P0 starter views render with zero entries and with fixture entries.
- Invalid views produce structured diagnostics.
- Rendered output does not persist to disk or enter `.forma/index.summary.json`.

## Relationship Notes

Blocked by parser, check/index, and operation dispatch foundation.

## Open Questions

- Exact HTML sanitization/rendering library choice can be made during
  implementation.
