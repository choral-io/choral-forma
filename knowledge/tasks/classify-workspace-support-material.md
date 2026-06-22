---
scope: project
type: task
title: Classify Workspace Support Material
summary: Decide which workspace-support notes should become shared knowledge and which should remain local-only context.
priority: P1
severity:
value: M
module: knowledge

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - knowledge
    - migration
    - workspace

effort: M
status: done
readiness: ready
sprint:

blocked_by: []
related_to:
    - "architecture/repository-forma-workspace-migration-design"
    - "planning/repository-knowledge-content-migration-audit"
    - "planning/workspace-support-material-classification"
    - "tasks/migrate-repository-knowledge-content"

reported_by:
affected_area: Repository workspace-support knowledge
---

# Classify Workspace Support Material

## Goal

Separate durable workspace-support knowledge from local-only execution context before completing the repository knowledge migration.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[planning/repository-knowledge-content-migration-audit]]
- [[planning/workspace-support-material-classification]]
- [[tasks/audit-repository-knowledge-migration-scope]]
- [[tasks/migrate-repository-knowledge-content]]

## In Scope

- Review shared workspace-support material and handoff-derived notes for durable product or process value.
- Promote durable knowledge into configured shared spaces when it has a clear owner, source, and ongoing use.
- Keep local-only execution context out of shared knowledge.
- Record deferred or intentionally omitted material.

## Out of Scope

- Importing private local workspace files.
- Preserving old local execution state.
- Creating new product requirements without review.

## Acceptance Criteria

- Workspace-support material is classified as promoted, retained, deferred, or omitted.
- Any promoted content links back to the source context and uses current Forma terminology.
- Local-only material remains outside shared knowledge and commits.
- The migration report records what was intentionally omitted.

## Result

Completed in [[planning/workspace-support-material-classification]]. No shared content move is needed for the current migration slice.
