# Execution

Use this reference for `run-next`, `run-loop`, `run-goal`, worker dispatch, and loop stop decisions.

## Modes

`run-next`: execute one topmost valid `Active` item.

```text
read WORKLIST -> select item -> validate -> plan -> execute -> review -> log -> update WORKLIST
```

`run-loop`: process multiple valid `Active` items only when the user explicitly asks to continue, process multiple items, or gives a loop budget.

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
candidate-source: Doing | Ready | Backlog | mixed
max-tasks:
max-items:
deadline:
parallel-work-items:
approval-mode:
isolation:
stop-at:
git-sync-policy:
kanban-policy:
review-policy:
```

If the contract is unclear, use `plan-only`.

## Selection Checkpoints

`run-goal` may re-check `Doing`, `Ready`, or `Backlog` after a task reaches review readiness, becomes blocked, exhausts local items, reaches a budget, or when the user asks to keep pulling eligible work.

At a checkpoint:

1. Check repository and worktree state.
2. If freshness matters, propose `git pull`; in `auto-review`, pull only when clean, low-risk, and no worker result is pending.
3. Re-read `knowledge/planning/KANBAN.md` and linked task context.
4. Use `next-task-selection` within the goal scope.
5. Intake only approved candidates.

Never move a card to `Done` from `run-goal`; use `delivery-review` and approved `kanban-maintenance`.

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

1. Collect candidate `Active` items within the budget plus small lookahead.
2. Validate each item.
3. Classify type, risk, likely touched areas, required skills, approvals, and checks.
4. Check dependencies and conflicts from item order, explicit links, task metadata, source references, likely files, blockers, and shared resources.
5. Select an independent batch no larger than `parallel-work-items`.
6. Dispatch only low- or medium-risk independent items.

Use isolated `.agents/.local/worktrees/slot-XX/` worktrees for parallel workers. Do not run parallel workers in the main worktree or shared serial worktree.

Parallel eligibility requires:

- valid, current, unblocked item;
- no dependency on another batch item;
- no likely overlap in files, schemas, APIs, migrations, lockfiles, fixtures, global styles, or shared resources;
- clear allowed paths, forbidden paths, validation, and success criteria;
- result can be reviewed and integrated independently;
- approval or elevated execution needs can route back to the main Agent.

If eligibility is uncertain, keep the work serial or use a read-only planner first.

## Dependencies And Stop Classes

Dependency layers:

- Kanban/task: `blocked_by` is hard, `related_to` is context, `unblocks` is value, shared module/source/resource is a conflict signal.
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
- `auto-review`: main Agent may approve low-risk local actions after reviewing scope, diff, and validation.
- `plan-only`: plan without implementation.

`auto-review` is not a policy bypass. Deletion, commits, publishing, external transmission, account or permission changes, software installation, local system changes, elevated execution, and other high-risk actions still require user confirmation. Worker subagents never self-approve elevation.

## Planning And Execution

Choose the lightest safe path:

- direct main-Agent plan for clear small work;
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

Use `knowledge/workspace/<member-id>/local/agent/` only for temporary loop coordination. Rebuild stale scratch from `WORKLIST.md`, copy important unlogged information to today's log, and clean scratch after durable logs and worklist updates are written.
