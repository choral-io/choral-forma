---
scope: project
type: task
priority: P0
severity:
value: H
module: knowledge

owners:
    - "members/Tiscs"
assignees:
    - "members/Tiscs"
reviewers: []
tags:
    - forma
    - knowledge
    - migration
    - workspace

effort: L
readiness: needs-refinement
sprint:

blocked_by:
    - "tasks/load-user-authored-space-schemas"
related_to:
    - "architecture/repository-forma-workspace-migration-design"
    - "tasks/migrate-repository-knowledge-to-forma-workspace"

reported_by:
affected_area: Repository knowledge content migration
---

# Migrate Repository Knowledge Content

## Goal

Migrate current repository knowledge content into the target Forma workspace structure after target space schemas and graph relation behavior are reviewable.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[tasks/load-user-authored-space-schemas]]
- [[tasks/migrate-repository-knowledge-to-forma-workspace]]

## In Scope

- Apply the target space mapping from the migration design.
- Rewrite or remove obsolete Knowledge Workflow compatibility notes.
- Promote useful shared workspace material and omit local-only state.
- Convert Forma-owned relationship fields to canonical path-qualified references.
- Keep localized files as variants of canonical pages, not independent canonical entries.

## Out of Scope

- Designing new runtime schema loading behavior.
- Implementing MCP.
- Adding automatic write repair operations.
- Preserving the current Knowledge Workflow layout as a compatibility contract.

## Acceptance Criteria

- Repository knowledge content is reorganized according to the target Forma spaces.
- Obsolete workflow compatibility language is removed where it no longer describes the current product.
- Relationship metadata follows the target reference policy.
- `forma knowledge health --json` has no migration-caused unresolved or ambiguous internal references.
- A migration report records changed paths, dropped compatibility assumptions, remaining warnings, and follow-up work.

## Refinement Notes

The schema-loading blocker is resolved by [[tasks/load-user-authored-space-schemas]] reaching Done. This task remains in Backlog with `readiness: needs-refinement` because broad content migration should be split into smaller reviewable slices before execution.
