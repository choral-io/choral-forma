---
name: delivery-planning
description: Produce dry-run delivery plans. Use for task candidates, Kanban card proposals, backlog planning, and proposed board changes before editing.
---

# Delivery Planning

Use this skill to propose Kanban changes from project knowledge. This skill produces a dry-run only.

Task items are candidates and context until an approved Kanban card links to them. Use this skill when the user asks to rank loose task items, review backlog candidates, or turn task items into accepted Kanban work.

## Workflow

1. Read `knowledge/planning/WORKFLOW.md`.
2. Read `knowledge/tasks/WORKFLOW.md`.
3. Read `knowledge/schemas/common.md` and `knowledge/schemas/tasks.md`.
4. Collect candidate task items and source knowledge.
5. Exclude local workspace notes, archived notes, and localized files.
6. When proposing assignees, reviewers, ownership fit, or handoffs, read only the relevant sections from `knowledge/members/<member-id>.md`, such as `Responsibilities`, `Focus Areas`, `Collaboration`, or `Availability`.
7. De-duplicate candidates against `knowledge/planning/KANBAN.md`.
8. Produce a dry-run table and wait for maintainer approval.

## Default Inputs

- `knowledge/product/**`
- `knowledge/discovery/**`
- `knowledge/concepts/**`
- `knowledge/architecture/**`
- `knowledge/decisions/**`
- `knowledge/guidelines/**`
- `knowledge/tasks/items/**`

Use `knowledge/guidelines/**` as planning context or constraints. Do not create Kanban candidates from guidelines alone unless a guideline explicitly defines executable delivery work.

Use `knowledge/discovery/**` as supporting evidence, assumptions, and opportunity context for product requirements. Do not create Kanban candidates from discovery analysis alone unless it has been accepted as product scope or a task item.

Use `knowledge/proposals/**` only as backlog review context. Do not create Kanban candidates directly from proposals. Accepted task proposals must be converted into task items before delivery planning.

Use `type: issue`, `type: bug`, and `type: defect` task items as delivery candidates only after triage shows they are actionable. Do not plan raw feedback, unverified observations, duplicates, invalid reports, or unresolved non-reproducible defects as Ready work.

Use `knowledge/workspace/*/summaries/**`, `knowledge/workspace/*/handoffs/**`, or `knowledge/workspace/*/research/**` only when the owner or maintainer explicitly selects it.

Never use `knowledge/workspace/*/local/**` as planning input.
Do not read member `local/AGENTS.md` for team planning.

## Output

- Concise summary of proposed cards.
- Dry-run table.
- Missing metadata or blockers.

## References

- For the dry-run table and task metadata examples, read `references/dry-run.md`.
