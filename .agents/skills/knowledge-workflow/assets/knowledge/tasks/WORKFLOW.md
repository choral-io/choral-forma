---
scope: project
type: process
owners:
  - "[[groups/{{default_group_id}}]]"
tags:
  - kanban
  - tasks
  - delivery
---

# Kanban Workflow

This document defines how project knowledge becomes delivery work tracked in `{{knowledge_dir}}/planning/KANBAN.md`.

## Core Rules

- Plan from canonical project knowledge, accepted task items, and explicitly selected shared workspace material.
- Do not plan from `workspace/*/local/**`, localized files, raw personal notes, secrets, or private material.
- Proposals are review buffers. Accepted task proposals must become task items before delivery planning or Kanban updates.
- Determine the current member id with `git config user.name`; do not infer it from OS, shell, machine, or chat names.
- Use `delivery-planning` for dry runs and `kanban-maintenance` only after explicit maintainer approval.

Allowed planning inputs:

```text
{{knowledge_dir}}/discovery/**
{{knowledge_dir}}/product/**
{{knowledge_dir}}/design/**
{{knowledge_dir}}/concepts/**
{{knowledge_dir}}/architecture/**
{{knowledge_dir}}/decisions/**
{{knowledge_dir}}/guidelines/**
{{knowledge_dir}}/planning/**
{{knowledge_dir}}/tasks/items/**
{{knowledge_dir}}/workspace/*/{summaries,handoffs,research}/** only when selected
```

## Task Items

Task items live in `{{knowledge_dir}}/tasks/items/` and follow `{{knowledge_dir}}/schemas/tasks.md`.

Use task items for durable delivery context:

- Goal
- Sources
- Scope and non-goals
- Acceptance criteria
- Implementation notes, risks, and open questions
- Metadata for priority, value, effort, module, readiness, ownership, assignment, review, blockers, and relationships

Common frontmatter fields:

```yaml
type: task # task | issue | bug | defect
priority: P1 # P0 | P1 | P2 | P3
severity: S2 # for issue/bug/defect impact
value: H # H | M | L
module: app
owners:
  - "[[members/member-id]]"
assignees:
  - "[[members/member-id]]"
reviewers:
  - "[[members/member-id]]"
effort: M # S | M | L
readiness: ready # ready | needs-refinement | blocked
blocked_by: []
related_to: []
unblocks: []
reported_by:
affected_area:
```

Use `blocked_by`, `related_to`, and `unblocks` with task knowledge-reference wikilinks instead of a generic dependency field when the relationship is known. Tool-written values should prefer path-qualified wikilinks such as `[[tasks/items/example-task]]`; manual short task wikilinks are valid only when they resolve uniquely. A missing or unclear blocker is a metadata issue; do not silently ignore it.

## Readiness

Use `readiness: needs-refinement` for vague or incomplete task items. Use `readiness: blocked` when a blocker, decision, external condition, or required access prevents work.

Use `readiness: ready` only when all are true:

- one clear goal and primary outcome;
- explicit scope, non-goals, and observable acceptance criteria;
- stable sources for product, design, architecture, decision, planning, task, or asset context;
- issue, bug, or defect context includes enough problem, impact, triage, and reproduction information to act safely;
- no unresolved `blocked_by` entries;
- rough `module`, `effort`, `priority`, and `value` are present or intentionally deferred with a reason;
- required source material is committed, and pushed to the default remote when one exists;
- execution does not depend on local-only, localized-only, secret, or private context.

Agents may propose readiness changes in dry-run output. Writing `readiness: ready` should happen only after maintainer approval or as part of an approved metadata dry run.

## Board

`{{knowledge_dir}}/planning/KANBAN.md` tracks delivery status.

Columns:

- `Backlog`: accepted candidate work not yet ready for implementation.
- `Ready`: work ready to be picked up.
- `Doing`: actively being implemented.
- `Reviewing`: under code, knowledge, or product review.
- `Blocked`: cannot proceed because a blocker is unresolved.
- `Done`: delivered and merged, with durable knowledge updated when needed.
- `Cancelled`: intentionally dropped or superseded.

Cards stay thin:

```md
- [ ] [[tasks/items/example-delivery-task|Example delivery task]]
```

The linked task item holds context and acceptance criteria. Prefer path-qualified task wikilinks in tool-written links and metadata. If a short manual link is ambiguous, report it instead of guessing.

## Planning And Selection

Create or update a Kanban card only when the work has a clear outcome, a focused scope, observable acceptance criteria, source links, and no local-only source dependency.

Before any Kanban write, produce a dry-run table and wait for explicit approval:

| Title                 | Sources                                                  | Module | Priority | Sprint   | Owners                            | Blockers | Target |
| --------------------- | -------------------------------------------------------- | ------ | -------- | -------- | --------------------------------- | -------- | ------ |
| Example delivery task | `{{knowledge_dir}}/tasks/items/example-delivery-task.md` | app    | P1       | Sprint 1 | `[[groups/{{default_group_id}}]]` | None     | Ready  |

Use `{{agent_skills_dir}}/next-task-selection/SKILL.md` to recommend accepted Kanban cards. Selection is read-only by default:

- select only cards from the board, not loose task items;
- prefer assigned current-member tasks, then unassigned tasks;
- starting another member's assigned task requires a second explicit confirmation;
- exclude unresolved blockers and non-ready tasks from automatic start;
- before automatic start or `Doing`, verify readiness, acceptance criteria, committed source material, remote freshness when relevant, clean worktree fit, and approval level.

## Personal Execution

Use `{{agent_skills_dir}}/workspace-worklist/SKILL.md` when a member takes accepted work into local execution.

- `intake-task` writes only the current member's `local/WORKLIST.md` and local logs.
- Intake should preserve links to the card, task item, and important source knowledge.
- Move or propose the card to `Doing` through approved `kanban-maintenance` at intake time or before the item becomes `Active`.
- Do not create detailed local execution items if the developer is not actually starting the task.
- Use `run-goal` only for accepted Kanban/worklist tasks and a user-approved scope; default stop point is review readiness or approved `Doing -> Reviewing`.

## Delivery Updates

Review order:

1. Move or propose `Doing -> Reviewing` through approved `kanban-maintenance`.
2. Run `delivery-review` while the card is in `Reviewing`.
3. If accepted, move or propose `Reviewing -> Done` through approved `kanban-maintenance`.
4. Keep the card in `Reviewing` for small fixes, move back to `Doing` for substantial rework, or move to `Blocked` for unresolved external blockers.

Definition of Done:

- acceptance criteria are satisfied or explicitly revised;
- implementation, documentation, and tests are complete for the scope;
- focused validation passed, or skipped checks are documented with a reason;
- required review is complete or residual risk is accepted by the maintainer;
- durable product, discovery, design, architecture, decision, guideline, or task knowledge was updated when the work changed it;
- local WORKLIST item and local log are closed;
- approved Kanban maintenance moved the card to `Done`.

When available, `superpowers:verification-before-completion` may support validation before completion, commit, PR, or Done-readiness claims. It does not replace `{{agent_skills_dir}}/delivery-review/SKILL.md` or approved Kanban maintenance.

## Knowledge Updates

Update durable knowledge when delivery changes it:

- user-facing behavior -> `product/`
- market, customer, competitor, business, or assumptions -> `discovery/`
- UI, interaction, layout, visual, or design system behavior -> `design/`
- module boundaries, APIs, data flow, integrations, configuration, or operations -> `architecture/`
- lasting product or technical tradeoff -> `decisions/`
- cross-area writing, terminology, language, documentation, or process -> `guidelines/`

No knowledge update is required for purely local implementation details that create no durable product or technical knowledge.

## Review Triggers

Use `{{agent_skills_dir}}/delivery-review/SKILL.md` before Done for:

- workflow, schema, AGENTS, or Skill changes;
- authentication, authorization, security, privacy, or data handling changes;
- cross-package interfaces, public APIs, persistence schemas, or migration behavior;
- user-visible product behavior or UI interaction changes;
- large refactors, broad file movement, or changes touching multiple modules;
- worker output after a failed or out-of-scope attempt;
- changed source knowledge after implementation.

## Blocked Or Cancelled Work

When blocked, move or propose the card to `Blocked`, set or propose `readiness: blocked`, and record the blocker in the linked task item. Move out of `Blocked` only when the blocker is resolved and the next state is clear.

When cancelled, move or propose the card to `Cancelled` and add a short cancellation reason if context would otherwise be unclear. Do not delete source knowledge unless it is wrong or obsolete and the user approves correction.

## Safety Rules

- Never edit `{{knowledge_dir}}/planning/KANBAN.md` without explicit maintainer approval.
- Never create Kanban cards from local-only workspace material.
- Never treat proposals, localized files, or raw notes as accepted delivery inputs.
- Keep cards concise and source-linked; do not mirror detailed task state everywhere.
- Stop and report possible secrets, sensitive data, source conflicts, unclear ownership, or approval gaps.
