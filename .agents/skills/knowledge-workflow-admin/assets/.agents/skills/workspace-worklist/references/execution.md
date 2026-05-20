# Execution

Use this reference for `run-next`, `run-loop`, `run-goal`, worker dispatch, and loop stop decisions.

## Modes

`run-next`: execute one topmost valid `Active` item.

```text
read WORKLIST -> select item -> validate -> plan -> execute -> review -> log -> update WORKLIST
```

`run-loop`: process multiple valid `Active` items only when the user explicitly gives or confirms a finite loop budget.

Unbounded wording such as "until the queue is empty" is not a finite budget. In that case, propose a finite contract and wait for confirmation, or use `plan-only`.

Default loop contract:

```text
max-items: 3
deadline: none
parallel-work-items: 1
approval-mode: user-confirm
isolation: shared-worktree
```

`run-goal`: advance accepted Kanban/worklist tasks toward review readiness. It is not open-ended product discovery or autonomous creation of new team work.

Default goal contract:

```text
max-tasks: 1
max-items: 3
deadline: none
parallel-work-items: 1
approval-mode: user-confirm
stop-at: reviewing-ready
```

`run-goal` composes existing workflow owners:

- task selection: `next-task-selection`
- board changes: `kanban-maintenance`
- local intake and execution: `workspace-worklist:intake-task`, `run-next`, `run-loop`
- review readiness: `delivery-review`

Before a long-running `run-goal`, present and confirm:

```text
goal:
scope:
current-member:
candidate-source: Reviewing | Doing | Ready | Backlog | mixed
max-tasks:
max-items:
deadline:
parallel-work-items:
approval-mode:
isolation:
stop-at:
policy-sources:
project-policy-status:
runtime-permission-model:
git-sync-policy:
kanban-policy:
review-policy:
source-stability-policy:
allowed-paths:
forbidden-actions:
protected-surfaces:
validation-strategy:
medium-risk-auto-review:
confirmation-required:
```

Before `run-loop`, present the same contract without `goal`, `candidate-source`, `max-tasks`, `kanban-policy`, and `review-policy`. If any contract field is unclear, use `plan-only`.

Contract field values:

| Field                     | Allowed values                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `approval-mode`           | `user-confirm`, `auto-review`, `plan-only`                                         |
| `isolation`               | `main-worktree`, `shared-worktree`, `slot-worktree`                                |
| `stop-at`                 | `item-done`, `reviewing-ready`, `budget-used`, `deadline`, `blocked`, `needs-user` |
| `git-sync-policy`         | `no-sync`, `pull-before-start`, `ask-before-sync`                                  |
| `kanban-policy`           | `no-board-edits`, `propose-only`, `approved-maintenance`                           |
| `review-policy`           | `self-check`, `delivery-review`, `reviewer-subagent-if-needed`                     |
| `source-stability-policy` | `lightweight`, `focused`, `strict`                                                 |

Use the default contract only after the user has confirmed that a loop or goal run should start. Do not treat missing values or unbounded wording as implicit approval to execute.

`approval-mode` is a Knowledge Workflow concept, not a runtime permission concept. It does not assume, require, replace, or bypass any Agent application, sandbox, or tool-host permission model. When runtime permissions are broader than the run contract, follow the run contract. When runtime permissions are stricter, obey the runtime boundary and report the block.

## Policy Sources And Merge

Build `run-loop` and `run-goal` execution policy from three sources:

1. Skill baseline policy: this skill, workflow rules, and repository safety rules. This is the hard floor.
2. Project policy: root `AGENTS.md` -> `Project-Specific Knowledge Workflow`.
3. Prompt policy: the current user instruction for this run.

Merge rules:

- Skill baseline cannot be weakened.
- Project policy may refine or tighten the baseline, and may authorize medium-risk auto-review only inside baseline guardrails.
- Prompt policy may narrow scope and enable automation inside the baseline and project policy. If project policy is missing or partial, explicit task-level prompt policy may supply temporary boundaries for the current run.
- If policies conflict, choose the more conservative rule or stop and ask.
- If project policy is missing or partial, warn before starting; the prompt may supplement this run, but stable rules should be proposed through maintainer workflow administration.

Assume runtime permissions may be broad or automatically approved. Use workflow policy as the self-limiting contract that decides what the Agent should do, even when the environment technically allows more.

Before `auto-review` or `run-goal`, check whether project policy defines:

- allowed paths or selection rules;
- protected or high-risk change surfaces;
- actions that require confirmation;
- validation strategy;
- whether medium-risk auto-review is allowed.

If project policy does not define enough execution boundaries, vague `auto-review` is limited to low-risk actions. Medium-risk work requires explicit task-level confirmation unless the prompt supplies clear temporary boundaries for this run.

## Selection Checkpoints

`run-goal` may re-check `Reviewing`, `Doing`, `Ready`, or `Backlog` after a task reaches review readiness, becomes blocked, exhausts local items, reaches a budget, or when the user asks to keep pulling eligible work.

Use this source order inside the confirmed scope:

1. `Reviewing` cards when the user asks for work closest to Done, review follow-up, or completion readiness. Route these to `delivery-review`; do not implement or move to Done directly.
2. `Doing` cards with linked current-member `Active` WORKLIST items. Continue these before pulling new Ready work unless the user explicitly excludes Doing.
3. `Ready` cards selected through `next-task-selection`.
4. `Backlog` cards only when explicitly included in the run goal; blocked planned dependencies remain context until blockers resolve.

When a prompt says "assigned Ready tasks", keep the scope to Ready even if local Active items exist. When a prompt says "Doing", "active", "continue", "closest to Done", or "finish current work", include the earlier source classes above.

At a checkpoint:

1. Check repository and worktree state.
2. If freshness matters, propose `git pull`; in `auto-review`, pull only when clean, classified as `low` risk, and no worker result is pending.
3. Re-read `<knowledge_dir>/planning/KANBAN.md` and linked task context.
4. Route `Reviewing` cards in scope to `delivery-review`.
5. Continue `Doing` cards with linked current-member Active WORKLIST items before selecting new Ready work.
6. Use `next-task-selection` for Ready or Backlog candidates within the goal scope.
7. Intake only approved candidates.

Never move a card to `Done` from `run-goal`; use `delivery-review` and approved `kanban-maintenance`.

## Source Stability

Default `source-stability-policy`: `focused`.

Use layered source checks so long-running `run-goal` stays reliable without expensive full scans:

| Policy        | When to use                                            | Required checks                                                                                                                                                    |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lightweight` | simple `run-next` or low-risk local work               | repository state, selected WORKLIST item, and directly linked task or note                                                                                         |
| `focused`     | default for `run-goal` and medium-risk work            | lightweight checks plus selected task `Sources`, `blocked_by`, required requirement/design/resource links, and likely dirty-file overlap                           |
| `strict`      | high-risk surfaces, unclear freshness, or user request | focused checks plus broader linked context, relevant schema/workflow rules, planned validation, and whether related sources are committed and synced when required |

Every checkpoint performs lightweight checks. Before starting a selected task, perform focused checks. Use strict checks only when the run contract, risk, dirty state, protected surface, worker dispatch, or user prompt requires it.

If source stability cannot be established, classify the item as `blocked`, `out-of-scope`, or `needs-user` instead of implementing.

## Downstream Follow-Up

Use two stages for tasks whose completion may release downstream work:

1. At `reviewing-ready`, reverse-look up downstream tasks whose `blocked_by` references the selected task and report possible follow-up only. Do not change downstream readiness or Kanban state.
2. After `delivery-review` accepts the task, reverse-look up again and propose actionable downstream readiness, task metadata, or Kanban follow-up through the owning skill.

Never treat `reviewing-ready` as delivery completion or as permission to update downstream cards automatically.

## Deadlines

Parse user deadlines or durations to an absolute time and repeat it before starting.

At the deadline:

- do not select, intake, dispatch, or start new work;
- finish or pause the current atomic step safely;
- run only cheap validation needed to preserve state;
- write the local log, update WORKLIST, and record next action, blockers, partial work, and validation state.

Do not skip checks, review, approval, or Kanban gates to beat a deadline.

## Parallel Execution

Parallel work is opt-in. Use it only when the user explicitly authorizes parallel subagents and gives or accepts `parallel-work-items`.

Before dispatch:

1. Collect candidate `Active` items within the budget plus at most `parallel-work-items` additional lookahead items.
2. Validate each item.
3. Classify type, risk, likely touched areas, required skills, approvals, and checks.
4. Check dependencies and conflicts from item order, explicit links, task metadata, source references, likely files, blockers, and shared resources.
5. Select an independent batch no larger than `parallel-work-items`.
6. Dispatch only low- or medium-risk independent items.

Use isolated `<agent_local_dir>/worktrees/slot-XX/` worktrees for parallel workers. Do not run parallel workers in the main worktree or shared serial worktree.

Parallel eligibility requires:

- valid, current, not-blocked item;
- no dependency on another batch item;
- no likely overlap in files, schemas, APIs, migrations, lockfiles, fixtures, global styles, or shared resources;
- clear allowed paths, forbidden paths, validation, and success criteria;
- result can be reviewed and integrated independently;
- approval or elevated execution needs can route back to the main Agent.

If eligibility is uncertain, keep the work serial or use a read-only planner first.

## Dependencies And Stop Classes

Dependency layers:

- Kanban/task: `blocked_by` is hard, `related_to` is context, downstream unlocks are derived by reverse lookup, and shared module/source/resource is a conflict signal.
- WORKLIST: explicit "after", "depends on", or "requires" is hard; item order is only a weak default.

Keep implementation and its validation/review follow-up serial unless the dependency is clearly absent.

When an item cannot complete, classify the stop:

| Class                | Meaning                                                        | Default behavior                                |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `needs-user`         | approval, authority, credentials, or judgment required         | stop and ask                                    |
| `blocked`            | dependency, source, environment, or access unavailable         | log, mark waiting, continue only if independent |
| `out-of-scope`       | would exceed item, forbidden area, or team-status boundary     | stop and report                                 |
| `failed`             | validation/execution failed with no reliable repair path       | stop and report                                 |
| `done-with-warnings` | mostly complete with residual risk or skipped/incomplete check | log warning; stop if risk affects later items   |

Do not retry indefinitely or continue after high-risk failure, unclear repository state, out-of-scope change, or failed worker output.

## Approval Modes

- `user-confirm`: default; stop when confirmation is needed.
- `auto-review`: main Agent may continue after self-reviewing scope, risk, diff, validation, policy sources, and the run contract.
- `plan-only`: plan without implementation.

`auto-review` is a workflow approval mode. It is not runtime authorization, and it does not approve tool calls, escalation, sandbox overrides, or host-application permission prompts. Deletion, commits, publishing, external transmission, account or permission changes, software installation, local system changes, elevated execution, and project-defined protected or high-risk surfaces still require user confirmation at the workflow layer. Worker subagents never self-approve elevation.

Use this risk classification before self-approval:

| Risk     | Conditions                                                                                                                          | Workflow auto-review behavior                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `low`    | Local-only notes/logs, read-only checks, formatting approved files, or edits limited to approved paths                              | Main Agent may proceed after review when the run contract allows it                                                                                        |
| `medium` | Source code, shared knowledge, task metadata, or generated artifacts within approved scope                                          | Proceed only when user allowed auto-review and project policy or explicit task-level prompt policy allows medium-risk automation for the affected scope    |
| `high`   | Deletion, reset, migration, dependency install, external publish/transmission, secrets, permissions, commits, or protected surfaces | Requires explicit workflow confirmation unless the current user instruction and project policy both give a specific task-level exception inside guardrails |

If any condition from a higher risk row applies, use the higher risk. If risk cannot be classified, treat it as `high`.

## Planning And Execution

Choose the lightest safe path:

- direct main-Agent plan for work that fits one file or one tightly scoped change and has no unresolved dependency;
- read-only planner for unclear requirements, multi-file scope, dependency checks, risk assessment, or context pressure;
- worker for bounded execution;
- shared worktree for serial isolation;
- slot worktree only for authorized parallel batches.

Planner output:

```md
## Plan

## Scope

## Proposed Subtasks

## Allowed Paths

## Risks

## Required Checks

## Confirmation Needed

## Suggested Execution Mode

direct | worker | shared-worktree
```

Treat one WORKLIST item as the main task. It may have one subtask layer; deeper bullets are details, not independent execution levels.

## Worker Protocol

Worker receives summary, item id, batch mode, approved plan, allowed/forbidden paths, dependency assumptions, validation requirements, execution mode, and worktree path.

Worker must not edit `WORKLIST.md`, logs, local scratch state, `KANBAN.md`, another member workspace, final project commits, or team status; must not spawn subagents or expand scope.

Worker output:

```md
## Result

completed | blocked | failed | needs-review

## Changed Files

## Scope Check

## Validation

## Follow-ups

## Risk

low | medium | high

## Worklog Draft
```

The main Agent reviews changed files, allowed paths, relevant diff, validation, risks, and follow-ups before updating WORKLIST or logs. Use reviewer subagents only for large diffs, workflow/schema/AGENTS/Skill changes, subtle regressions, or failed-worker follow-up.

If a worker is blocked, fails, leaves dirty state, or reports unusable state, make one bounded non-destructive recovery decision. If recovery would need reset, clean, rebase, merge, delete, rebuild, credentials, business judgment, or scope change, stop or use `references/worktree-lifecycle.md`.

## Handoff And Scratch

Default run handoffs belong in the final response, local log, or current worklist item. Create a shared handoff file only when team-relevant, cross-member, long-lived, complex enough to survive chat, or explicitly requested.

Use `<agent_local_dir>/runs/<work-id>/` only for temporary loop coordination. Rebuild stale scratch from `WORKLIST.md`, copy important unlogged information to today's log, and clean scratch after durable logs and worklist updates are written.
