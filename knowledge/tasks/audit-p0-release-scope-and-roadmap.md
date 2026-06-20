---
scope: project
type: task
priority: P0
severity:
value: H
module: knowledge

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - planning
    - release

effort: S
status: done
readiness: ready
sprint:

blocked_by: []
related_to:
    - "tasks/implement-ci-release-baseline"
    - "tasks/implement-read-only-webapp"
    - "tasks/implement-reference-navigation-baseline"
    - "tasks/implement-workspace-resource-routes"

reported_by:
affected_area: P0 roadmap and release scope
---

# Audit P0 Release Scope And Roadmap

## Goal

Reconcile the P0 product, architecture, delivery task list, and Kanban plan into a clear release-scope closure plan.

## Sources

- [[product/product-direction]]
- [[product/forma-p0-starter-spec]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-schema-dsl-spec]]
- [[architecture/forma-view-query-model]]
- [[decisions/forma-p0-core-architecture]]
- [[architecture/repository-forma-workspace-migration-design]]

## Context

Most P0 implementation tasks are now in Done, while the remaining active and backlog tasks include several P1/P2 product extensions. Continuing directly into the current Ready implementation task would improve resource health diagnostics, but it may not be the highest-leverage path for closing the P0 release.

This task is a planning and scope-convergence pass. It should identify what is already good enough for P0, what must still be fixed before release, and which tasks should be moved or rewritten as P1/P2 follow-up work.

## In Scope

- Review P0 product, architecture, operation, check/index, schema, starter, and view-query documents for current P0/P1 boundaries.
- Review the current Forma task board view and task metadata against the P0 boundary.
- Produce a P0 release bar with must-have, should-have, and deferred items.
- Identify any missing P0 closure tasks with observable acceptance criteria.
- Recommend task board changes as a dry-run table, including tasks to keep Ready, move to Backlog, split, cancel, or defer to P1/P2.
- Call out source-stability and release-readiness risks such as unpushed local commits or missing validation evidence.

## Out Of Scope

- Product code changes.
- Implementing health, graph, search, metadata edit, or proposal workflows.
- Changing P0 architecture decisions without a separate approved capture.
- Moving Kanban cards without maintainer approval.
- Release publishing or GitHub Actions release execution.

## Acceptance Criteria

- The report lists completed P0 capabilities and the remaining P0 closure gaps.
- The report separates P0 release blockers from P1/P2 follow-ups.
- Each recommended new or changed task has a target Kanban column and rationale.
- The report identifies at least one next executable task or states that P0 is ready for release validation.
- The report cites the project knowledge and task board sources used.
- No repository code or task implementation is changed.

## Relationship Notes

This task should run before continuing into P1/P2 implementation work. Its output may update roadmap, tasks, and Kanban after maintainer approval.

## Delivery Notes

- Added [[planning/p0-release-scope-audit]] as the P0 scope convergence report.
- Added [[tasks/run-p0-release-validation-and-cutline-check]] as the next executable P0 closure task candidate.
- Recommended Kanban updates are recorded as a dry run in the report. No additional Kanban movement was applied by this task.

## Open Questions

-
