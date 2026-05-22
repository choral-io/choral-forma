---
scope: project
type: task
priority: P1
severity:
value: M
module: api

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - metadata
    - operations

effort: M
readiness: needs-refinement
sprint:

blocked_by: []
related_to:
    - "[[tasks/implement-operation-rpc-cli-foundation]]"
    - "[[tasks/implement-markdown-forma-ast-parser]]"

reported_by:
affected_area: Metadata edit and lifecycle operations
---

# Design Metadata Edit And Deprecate Operations

## Goal

Design the first safe operation contracts for metadata edits and deprecating
knowledge entries.

## Sources

- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-core-technical-direction]]
- [[tasks/implement-operation-rpc-cli-foundation]]
- [[tasks/implement-markdown-forma-ast-parser]]

## Context

The current P0 implementation intentionally avoids modifying existing
frontmatter or Markdown bodies. Architecture notes reserve future operations
such as `set`, `add`, `remove`, `unset`, and `deprecate`, with confirmation
rules depending on whether an operation touches one file, many files, or
references.

## In Scope

- Define product and operation semantics for one-file metadata edits.
- Define product and operation semantics for deprecating one entry.
- Define confirmation, dry-run, diagnostics, and failure behavior.
- Define how edits should preserve Markdown body, unknown frontmatter fields,
  ordering, and comments where practical.
- Identify whether implementation should be split into separate delivery tasks.
- Update architecture and task knowledge with the accepted design.

## Out Of Scope

- Implementing the edit operations.
- Batch edits.
- Reference rewrites.
- Physical delete, move, or rename operations.
- Automatic fix application.

## Acceptance Criteria

- The operation contract for metadata edit and deprecate candidates is
  documented.
- Confirmation and non-interactive behavior is explicit.
- The design distinguishes one-file edits from batch or reference-changing
  operations.
- Implementation follow-up tasks can be created with observable acceptance
  criteria.
- The design does not conflict with the repository-file source-of-truth model.

## Relationship Notes

This is a design task, not an implementation task. It prepares future write
operations without broadening the current P0 read-only WebApp scope.

## Open Questions

- Should frontmatter patching be implemented with a comment/order-preserving
  YAML layer, or is a simpler generated-frontmatter strategy acceptable for
  early write operations?
- Should `deprecate` use a conventional metadata field or collection-defined
  schema configuration?
