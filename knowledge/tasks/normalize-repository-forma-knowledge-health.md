---
scope: project
type: task
priority: P1
severity:
value: M
module: knowledge

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - health
    - knowledge
    - migration

effort: M
status: ready
readiness: ready
sprint:

blocked_by: []
related_to:
    - "architecture/repository-forma-workspace-migration-design"
    - "planning/repository-knowledge-content-migration-report"
    - "tasks/migrate-repository-knowledge-to-forma-workspace"

reported_by:
affected_area: Repository knowledge health normalization
---

# Normalize Repository Forma Knowledge Health

## Goal

Normalize remaining Forma health warnings after repository knowledge content has been migrated into the target workspace structure.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[tasks/migrate-repository-knowledge-content]]
- [[tasks/migrate-repository-knowledge-to-forma-workspace]]

## In Scope

- Fix true broken references, ambiguous references, and unsupported fragments.
- Suppress or document intentional warnings according to the migration health policy.
- Verify list, board, inspect, file references, graph, and knowledge health operations against the migrated workspace.
- Record follow-up tasks for warnings that should not be fixed in this slice.

## Out of Scope

- Broad content migration.
- Productizing strict enforcement for every health warning.
- Adding persistent index, diagnostic, or cache files.

## Acceptance Criteria

- `forma knowledge health --json` reports only meaningful accepted warnings under the target policy.
- Any remaining warnings are listed with owner, rationale, and follow-up status.
- CLI/WebApp read operations describe the migrated workspace accurately enough for internal review.
