---
scope: project
type: task
title: Classify Workspace Material
summary: Decide which workspace notes should become shared project content and which should remain local-only context.
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
    - historical

effort: M
status: done
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "architecture/repository-forma-workspace-migration-design"
    - "planning/repository-knowledge-content-migration-audit"
    - "planning/workspace-material-classification"
    - "tasks/migrate-repository-knowledge-content"

reportedBy:
affectedArea: Repository workspace knowledge
---

# Classify Workspace Material

## Goal

Separate durable workspace knowledge from local-only execution context before completing the repository knowledge migration.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[planning/repository-knowledge-content-migration-audit]]
- [[planning/workspace-material-classification]]
- [[tasks/audit-repository-knowledge-migration-scope]]
- [[tasks/migrate-repository-knowledge-content]]

## In Scope

- Review shared workspace material and handoff-derived notes for durable product or process value.
- Promote durable knowledge into configured shared spaces when it has a clear owner, source, and ongoing use.
- Keep local-only execution context out of shared project content.
- Record deferred or intentionally omitted material.

## Out of Scope

- Importing private local workspace files.
- Preserving old local execution state.
- Creating new product requirements without review.

## Acceptance Criteria

- Workspace material is classified as promoted, retained, deferred, or omitted.
- Any promoted content links back to the source context and uses current Forma terminology.
- Local-only material remains outside shared project content and commits.
- The migration report records what was intentionally omitted.

## Result

Completed in [[planning/workspace-material-classification]]. No shared content move is needed for the current migration slice.
