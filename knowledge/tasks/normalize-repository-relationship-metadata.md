---
scope: project
type: task
title: Normalize Repository Relationship Metadata
summary: Canonicalize repository knowledge relationship fields to path-qualified references.
priority: P0
severity:
value: H
module: knowledge

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - knowledge
    - metadata
    - graph
    - historical

effort: M
status: done
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "architecture/repository-forma-workspace-migration-design"
    - "planning/repository-knowledge-content-migration-audit"
    - "tasks/migrate-repository-knowledge-content"
    - "tasks/normalize-repository-forma-knowledge-health"

reportedBy:
affectedArea: Repository knowledge relationship metadata
---

# Normalize Repository Relationship Metadata

## Goal

Normalize Forma-owned relationship fields so graph and health behavior are based on canonical path-qualified references.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[planning/repository-knowledge-content-migration-audit]]
- [[tasks/audit-repository-knowledge-migration-scope]]
- [[tasks/normalize-repository-forma-knowledge-health]]

## In Scope

- Audit and update fields such as `owners`, `assignees`, `reviewers`, `blockedBy`, `relatedTo`, and source-like relationship fields.
- Preserve plain scalar fields that are not intended to be graph relationships.
- Keep changes focused on metadata and directly related link text.

## Out of Scope

- Redesigning graph edge configuration.
- Changing task schemas or view definitions.
- Rewriting document prose unrelated to relationship metadata.

## Acceptance Criteria

- Relationship metadata uses path-qualified references where the target is a repository knowledge page.
- `forma check` reports no unresolved or ambiguous references introduced by the normalization.
- `forma knowledge health` reports no new relationship-metadata warnings.
- Any intentionally unresolved or external relationships are documented in the migration audit or follow-up notes.

## Result

Frontmatter relationship values no longer use wikilink strings or `.md` suffixed page references. Product-direction examples now distinguish canonical metadata refs such as `members/alex-chen` from workspace file paths such as `tasks/foo.md`.
