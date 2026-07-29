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
skill:
    id: task-selection
    title: Task Selection
    description: Use when an Agent needs to choose, inspect, refine, or report delivery task state.
    triggers:
        - choose next task
        - inspect task readiness
        - review task board
        - move task status
    order: 30
sources:
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "guidelines/forma-workspace-operations"
---

# Task And Delivery Guidance

## Purpose

This guideline consolidates the soft delivery behavior previously spread across task selection, task metadata audit, delivery planning, Kanban maintenance, delivery implementation, and delivery review skills.

It guides humans and Agents. It is not a machine-enforced policy and does not authorize board or task writes without explicit approval.

## Agent Skill

### When To Use

Use this skill when an Agent needs to choose the next task, inspect task readiness, review delivery state, or prepare a task for execution.

### Required Bootstrap

Run:

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- skills get proposal-and-dry-run`
- `cargo run -q -p forma-cli -- list --space tasks --json`
- `cargo run -q -p forma-cli -- view render .forma/views/task-board --json`

Inspect candidate tasks with `cargo run -q -p forma-cli -- inspect <task-path> --json` or `cargo run -q -p forma-cli -- inspect --space tasks <entry-id> --json` before recommending or changing status.

Use [[guidelines/proposal-and-dry-run]] before any task status, readiness, blocker, owner, assignee, reviewer, release evidence, or board membership change. Task and board recommendations are proposals until the human explicitly approves the exact change.

### Task Selection Workflow

1. Prefer tasks whose metadata and status indicate they are actionable.
2. If no ready task exists, choose the highest-leverage backlog item and report what must be refined.
3. Check blockers, dependencies, acceptance criteria, owner context, and review expectations before execution.
4. Recommend status changes only when the task evidence supports them.
5. Keep selection grounded in current task metadata and configured board semantics.

### Delivery State Semantics

Use `status` as delivery state and board membership:

- `backlog`: accepted candidate that is not selected for near-term execution.
- `ready`: ready candidate pool.
- `doing`: active implementation.
- `reviewing`: implementation is ready for review.
- `blocked`: active work cannot continue because a blocker is unresolved.
- `done`: delivered work is accepted.
- `cancelled`: intentionally dropped, replaced, duplicated, invalid, or no longer valuable.

Use `readiness` as executability:

- `needs-refinement`: scope, sources, ownership, or acceptance criteria are incomplete.
- `ready`: the task has enough source material and acceptance criteria to start.
- `blocked`: a dependency, decision, external condition, or access requirement prevents starting.

Do not change `status`, `readiness`, `blockedBy`, `owners`, `assignees`, or `reviewers` without explicit approval.

### Priority, Value, And Effort

Use `priority` for urgency or ordering pressure, `value` for expected delivery value, and `effort` for relative implementation size. Prefer preserving existing values unless the task evidence clearly supports a proposed change.

### Report

Report the selected task, why it is next, what evidence supports the recommendation, and what must change before execution if it is not ready.

### Evidence To Gather

Start from Forma operations, not hidden workflow files:

- `cargo run -q -p forma-cli -- config summary --group tasks --sources --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- `cargo run -q -p forma-cli -- list --space tasks --json`
- `cargo run -q -p forma-cli -- view render .forma/views/task-board --json`

Inspect candidate tasks with:

- `cargo run -q -p forma-cli -- inspect <task-path> --json`
- `cargo run -q -p forma-cli -- inspect --space tasks <entry-id> --json`
- `cargo run -q -p forma-cli -- workspace explain <task-path> --json`

Use source documents linked from the task when acceptance, scope, or product intent matters. Use current member context only when ownership, assignment, focus area, or capacity is explicitly relevant.

### Task Selection

Select from accepted board tasks before loose task items. Prefer `Ready` tasks over `Backlog` tasks unless the user asks for backlog refinement.

Exclude or flag tasks that:

- are in `Blocked`;
- have unresolved `blockedBy` references;
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

### Readiness And Metadata Audit

Report task quality issues instead of silently fixing them:

- missing or unresolved owners for ready, scheduled, assigned, or maintained tasks;
- missing assignees when active assignment is expected;
- missing reviewers when review responsibility is expected;
- unresolved `blockedBy` or `relatedTo` references;
- `Ready` board cards whose task metadata is not `readiness: ready`;
- `Ready` tasks with unresolved blockers;
- `Blocked` tasks without blocker metadata or an explicit blocker note;
- backlog tasks that appear ready but have not been promoted;
- issue, bug, or defect tasks without enough problem, impact, triage, reproduction, expected, or actual context.

Treat `status` as board membership and `readiness` as executability. Do not use `assignees` as board state.

### Board And Task Writes

Do not move board cards, change task status, or edit readiness metadata without explicit user approval.

Before proposing or applying task metadata changes, load [[guidelines/proposal-and-dry-run]] and use its task or board change template. If the user asked for evaluation, selection, or review only, stop at a recommendation and do not edit.

For approved board or status changes:

- apply only the approved change;
- keep board state thin and task metadata authoritative;
- preserve the configured column order;
- when moving to `Blocked`, record blocker details in the task;
- do not move `Reviewing -> Done` while known dependency follow-up is unresolved unless the maintainer explicitly defers it;
- after completing a task, look for downstream tasks whose blockers may now be resolved.

### Implementation And Review

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

### Recommendation Output

When recommending the next task, include:

- selected task path and status/readiness;
- assignment partition used;
- short rationale;
- evidence commands or files checked;
- blocker or metadata problems;
- auto-start decision: `recommendation only`, `needs confirmation`, or `started`;
- proposed board move only as a proposal unless already approved.
