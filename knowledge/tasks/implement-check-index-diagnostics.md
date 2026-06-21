---
scope: project
type: task
priority: P0
severity:
value: H
module: api

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - index
    - diagnostics

effort: L
status: done
readiness: ready
sprint:

blocked_by:
    - "tasks/implement-schema-dsl-runtime-values"
    - "tasks/implement-markdown-forma-ast-parser"
related_to:
    - "architecture/forma-p0-check-index-spec"

reported_by:
affected_area: Summary index and workspace diagnostics
---

# Implement Check Index Diagnostics

## Goal

Implement the shared discovery, check, diagnostics, and in-memory summary projection pipeline for P0.

## Sources

- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[decisions/forma-p0-core-architecture]]

## Context

P0 no longer writes or requires a committed persistent index file. Operations discover workspace state at runtime and build deterministic in-memory projections for checks, list views, renders, and RPC responses. Diagnostics are runtime operation results and must not be persisted.

## In Scope

- Discover spaces, views, entries, and successfully resolved references.
- Build deterministic in-memory summary projections without writing them to disk.
- Implement diagnostic result shape, status values, diagnostic code families, and location objects.
- Ensure unresolved and ambiguous references appear as diagnostics, not resolved refs.
- Add golden JSON fixtures for valid, unresolved-ref, ambiguous-ref, invalid-frontmatter, invalid-config, invalid-view, and path-cases workspaces.

## Out Of Scope

- Local full index, SQLite, vector search, filesystem watchers, or incremental indexing.
- Persisted diagnostic result files.
- Automatic repair or fix commands.

## Acceptance Criteria

- `check` builds discovery state in memory and reports diagnostics without writing files.
- No operation writes or requires a persistent index artifact.
- Public JSON contains workspace-relative POSIX paths only.
- Golden tests cover deterministic ordering and exclusion of diagnostics from resolved refs and in-memory projections.

## Relationship Notes

Previously blocked by Schema DSL/runtime values and Markdown FormaAST parser; both prerequisites are now done.

## Open Questions

- None.
