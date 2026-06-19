---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "members/Tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - webapp
    - proposal
    - operations

effort: M
readiness: needs-refinement
sprint:

blocked_by:
    - "tasks/implement-webapp-v2-dashboard-shell"
related_to:
    - "tasks/design-reviewable-knowledge-change-proposals"
    - "tasks/design-metadata-edit-deprecate-operations"
    - "decisions/webapp-primary-gui-client"
    - "planning/webapp-primary-gui-roadmap"

reported_by:
affected_area: Reviewable WebApp operations
---

# Design Reviewable Operation Proposal Flow

## Goal

Design how WebApp interactions that imply repository changes become explicit operation proposals, dry-runs, previews, and approved apply actions.

## Sources

- [[decisions/webapp-primary-gui-client]]
- [[planning/webapp-primary-gui-roadmap]]
- [[tasks/design-reviewable-knowledge-change-proposals]]
- [[tasks/design-metadata-edit-deprecate-operations]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

The WebApp is becoming the primary GUI client, but repository Markdown remains the source of truth. Interactive UI features such as kanban drag-and-drop, predefined buttons, guided maintenance, and AI-suggested edits must not silently rewrite files. The product needs a reviewable operation proposal model before write-adjacent GUI workflows are implemented.

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

This task should be refined after the WebApp V2 dashboard shell establishes the primary GUI structure. It can absorb or coordinate with [[tasks/design-reviewable-knowledge-change-proposals]] when the product model is settled.

## Open Questions

- Should proposals be represented as repository files, local-only runtime state, generated diffs, or all three in different states?
- Should the first apply path be WebApp-only, CLI-first, or shared from the beginning?
