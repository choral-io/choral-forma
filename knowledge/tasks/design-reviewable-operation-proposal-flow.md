---
scope: project
type: task
priority: P2
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p2
    - webapp
    - proposal
    - operations

effort: M
status: backlog
readiness: needs-refinement
sprint:

blockedBy:
    - "tasks/design-reviewable-forma-write-operations"
relatedTo:
    - "decisions/editor-extension-primary-product-surface"
    - "tasks/design-reviewable-forma-write-operations"
    - "tasks/design-reviewable-knowledge-change-proposals"
    - "tasks/design-metadata-edit-deprecate-operations"

reportedBy:
affectedArea: Reviewable WebApp operations
---

# Design Reviewable Operation Proposal Flow

## Goal

Design how WebApp interactions that imply repository changes become explicit operation proposals, dry-runs, previews, and approved apply actions.

This WebApp-specific interaction design is deferred while editor extensions are the primary product surface. Shared reviewable write-operation semantics remain tracked separately and are not cancelled by this deferral.

## Sources

- [[decisions/editor-extension-primary-product-surface]]
- [[tasks/design-reviewable-knowledge-change-proposals]]
- [[tasks/design-metadata-edit-deprecate-operations]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

The completed WebApp baseline remains a maintenance surface, while repository Markdown remains the source of truth. Any future write-adjacent GUI feature, including kanban drag-and-drop, predefined actions, guided maintenance, or AI-suggested edits, must not silently rewrite files. It must specialize a shared reviewable operation model rather than create a WebApp-only write boundary.

## In Scope

- Define the user-facing proposal flow for WebApp actions that may change files.
- Define operation plan, dry-run, preview, diagnostics, confirmation, and apply states.
- Identify the minimal RPC/CLI backend capabilities needed for operation proposals.
- Define how proposals relate to repository files, Git diffs, diagnostics, and future metadata edit/deprecate operations.
- Decide which proposal data is persisted, local-only, or generated on demand.
- Create follow-up implementation tasks with observable acceptance criteria.

## Out Of Scope

- Implementing proposal persistence or apply behavior.
- Implementing metadata edit, deprecate, delete, move, rename, or automatic fix commands.
- AI Chat behavior beyond how AI-generated suggestions enter the proposal flow.
- Git hosting, pull request automation, or multi-user realtime review.

## Acceptance Criteria

- The proposal flow clearly separates read-only browsing, dry-run planning, and approved writes.
- The design explains what users see before any file-changing action.
- The design identifies required shared operation/RPC contracts.
- The design preserves repository files as durable source of truth.
- Follow-up tasks can be created for implementation.

## Relationship Notes

This task remains deferred under [[decisions/editor-extension-primary-product-surface]]. Refine it only if an approved WebApp maintenance requirement needs a write-adjacent flow; it can then absorb or coordinate with [[tasks/design-reviewable-knowledge-change-proposals]] when the product model is settled.

It should also follow [[tasks/design-reviewable-forma-write-operations]], because WebApp proposal states should specialize the shared operation contract rather than define a separate write boundary.

## Open Questions

- Should proposals be represented as repository files, local-only runtime state, generated diffs, or all three in different states?
- Should the first apply path be WebApp-only, CLI-first, or shared from the beginning?
