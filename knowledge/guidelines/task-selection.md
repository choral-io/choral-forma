---
scope: project
title: Task And Delivery Guidance
summary: Soft Human and Agent procedure for task selection, delivery readiness, board maintenance, and review evidence.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - tasks
    - delivery
    - planning
sources:
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "guidelines/forma-knowledge-operations"
---

# Task And Delivery Guidance

## Purpose

This guideline consolidates the soft delivery behavior previously spread across task selection, task metadata audit, delivery planning, Kanban maintenance, delivery implementation, and delivery review skills.

It guides humans and Agents. It is not a machine-enforced policy and does not authorize board or task writes without explicit approval.

## Evidence To Gather

Start from Forma operations, not hidden workflow files:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`
- `cargo run -q -p forma-cli -- board show --json`
- `cargo run -q -p forma-cli -- tasks list --json`

Inspect candidate tasks with:

- `cargo run -q -p forma-cli -- tasks inspect --json <task-path>`

Use source documents linked from the task when acceptance, scope, or product intent matters. Use current member context only when ownership, assignment, focus area, or capacity is explicitly relevant.

## Task Selection

Select from accepted board tasks before loose task items. Prefer `Ready` tasks over `Backlog` tasks unless the user asks for backlog refinement.

Exclude or flag tasks that:

- are in `Blocked`;
- have unresolved `blocked_by` references;
- have `readiness: blocked`;
- are localized variants rather than canonical task files;
- depend on private, local-only, or uncommitted source material;
- lack observable acceptance criteria.

Partition eligible tasks by assignment:

- assigned to the current member;
- unassigned;
- assigned to someone else.

Prefer assigned or unassigned tasks before work assigned only to someone else. Starting someone else's assigned work requires explicit confirmation.

When comparing candidates, value:

1. Downstream unlock potential.
2. Release, validation, migration, or architectural risk reduction.
3. Clear acceptance criteria and source traceability.
4. Fit with the user's current request and execution window.
5. Low ambiguity and low cross-module blast radius.

## Readiness And Metadata Audit

Report task quality issues instead of silently fixing them:

- missing or unresolved owners for ready, scheduled, assigned, or maintained tasks;
- missing assignees when active assignment is expected;
- missing reviewers when review responsibility is expected;
- unresolved `blocked_by` or `related_to` references;
- `Ready` board cards whose task metadata is not `readiness: ready`;
- `Ready` tasks with unresolved blockers;
- `Blocked` tasks without blocker metadata or an explicit blocker note;
- backlog tasks that appear ready but have not been promoted;
- issue, bug, or defect tasks without enough problem, impact, triage, reproduction, expected, or actual context.

Treat `status` as board membership and `readiness` as executability. Do not use `assignees` as board state.

## Board And Task Writes

Do not move board cards, change task status, or edit readiness metadata without explicit user approval.

For approved board or status changes:

- apply only the approved change;
- keep board state thin and task metadata authoritative;
- preserve the configured column order;
- when moving to `Blocked`, record blocker details in the task;
- do not move `Reviewing -> Done` while known dependency follow-up is unresolved unless the maintainer explicitly defers it;
- after completing a task, look for downstream tasks whose blockers may now be resolved.

## Implementation And Review

Before implementation, read the task, its source context, and relevant product or architecture decisions. Keep code, tests, and knowledge aligned.

Review readiness should include:

- task source context;
- acceptance criteria covered;
- files changed;
- checks run;
- checks not run;
- residual risks;
- whether knowledge or board follow-up is needed.

Review reports should lead with findings. If no issues are found, say that directly and list any residual test or knowledge gaps.

## Recommendation Output

When recommending the next task, include:

- selected task path and status/readiness;
- assignment partition used;
- short rationale;
- evidence commands or files checked;
- blocker or metadata problems;
- auto-start decision: `recommendation only`, `needs confirmation`, or `started`;
- proposed board move only as a proposal unless already approved.
