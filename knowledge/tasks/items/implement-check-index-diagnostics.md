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
  - index
  - diagnostics
priority: P0
severity:
value: H
module: api
effort: L
readiness: ready
sprint:
blocked_by:
  - "[[tasks/items/implement-schema-dsl-runtime-values]]"
  - "[[tasks/items/implement-markdown-forma-ast-parser]]"
related_to:
  - "[[architecture/forma-p0-check-index-spec]]"
reported_by:
affected_area: Summary index and workspace diagnostics
---

# Implement Check Index Diagnostics

## Goal

Implement the shared discovery, check, diagnostics, and summary-index pipeline
for P0.

## Sources

- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[decisions/forma-p0-core-architecture]]

## Context

`.forma/index.summary.json` is a committed deterministic discovery artifact.
Diagnostics are runtime operation results and must not be persisted.

## In Scope

- Discover collections, views, entries, and successfully resolved references.
- Generate deterministic `.forma/index.summary.json`.
- Implement in-memory index freshness comparison.
- Implement diagnostic result shape, status values, diagnostic code families,
  and location objects.
- Ensure unresolved and ambiguous references appear as diagnostics, not index
  refs.
- Add golden JSON fixtures for valid, stale-index, unresolved-ref,
  ambiguous-ref, invalid-frontmatter, invalid-config, invalid-view, and
  path-cases workspaces.

## Out Of Scope

- Local full index, SQLite, vector search, filesystem watchers, or incremental
  indexing.
- Persisted diagnostic result files.
- Automatic repair or fix commands.

## Acceptance Criteria

- `index rebuild` output is byte-stable for unchanged fixtures.
- `index check` detects missing, invalid, and stale summary indexes.
- `check` reports diagnostics without writing files.
- Public JSON contains workspace-relative POSIX paths only.
- Golden tests cover deterministic ordering and exclusion of diagnostics from
  the summary index.

## Relationship Notes

Previously blocked by Schema DSL/runtime values and Markdown FormaAST parser;
both prerequisites are now done.

## Open Questions

- None.
