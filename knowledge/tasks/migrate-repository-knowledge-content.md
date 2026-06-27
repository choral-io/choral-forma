---
scope: project
type: task
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
    - migration
    - workspace
    - historical

effort: L
status: done
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "architecture/repository-forma-workspace-migration-design"
    - "planning/repository-knowledge-content-migration-audit"
    - "planning/workspace-support-material-classification"
    - "planning/repository-knowledge-content-migration-report"
    - "tasks/migrate-repository-knowledge-to-forma-workspace"
    - "tasks/audit-repository-knowledge-migration-scope"
    - "tasks/clean-obsolete-knowledge-workflow-language"
    - "tasks/normalize-repository-relationship-metadata"
    - "tasks/classify-workspace-support-material"

reportedBy:
affectedArea: Repository knowledge content migration
---

# Migrate Repository Knowledge Content

## Goal

Migrate current repository knowledge content into the target Forma workspace structure after target space schemas and graph relation behavior are reviewable.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[planning/repository-knowledge-content-migration-audit]]
- [[planning/workspace-support-material-classification]]
- [[planning/repository-knowledge-content-migration-report]]
- [[tasks/load-user-authored-space-schemas]]
- [[tasks/migrate-repository-knowledge-to-forma-workspace]]
- [[tasks/audit-repository-knowledge-migration-scope]]

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
- `forma workspace health --json` has no migration-caused unresolved or ambiguous internal references.
- A migration report records changed paths, dropped compatibility assumptions, remaining warnings, and follow-up work.

## Refinement Notes

The schema-loading blocker is resolved by [[tasks/load-user-authored-space-schemas]] reaching Done. This task remains in Backlog with `readiness: needs-refinement` because broad content migration is tracked through smaller reviewable slices.

Execution split:

- [[tasks/audit-repository-knowledge-migration-scope]] is the first executable slice and should produce the migration inventory.
- [[tasks/clean-obsolete-knowledge-workflow-language]] should use the audit to remove non-current workflow compatibility wording.
- [[tasks/normalize-repository-relationship-metadata]] should use the audit to canonicalize Forma-owned relationship fields.
- [[tasks/classify-workspace-support-material]] should use the audit to decide what support material becomes shared project content.

The umbrella task should become reviewable only after the split tasks produce the migration report and leave no migration-caused health warnings.

## Result

Completed in [[planning/repository-knowledge-content-migration-report]]. Remaining health warnings are not migration-caused unresolved or ambiguous references and are tracked by [[tasks/normalize-repository-forma-knowledge-health]].
