---
name: workspace-worklist
description: Maintain and run the current member's local WORKLIST.md. Use for local work intake, run-next, run-loop, run-goal, plan-only, grooming, and progress logs.
---

# Workspace Worklist

## Runtime Context

Before acting, use the repository Knowledge Workflow runtime context from root `AGENTS.md` and its manifest; do not assume workflow paths or default ids.

Use this skill for personal, local member work under `<knowledge_dir>/workspace/<member-id>/local/`.

## Core Rules

- Determine the current member id with `git config user.name`.
- If `<knowledge_dir>/members/<member-id>.md` exists, read only the relevant public sections for the current action, such as `Profile` or `Focus Areas`.
- If `<knowledge_dir>/workspace/<member-id>/local/AGENTS.md` exists, read it for personal collaboration preferences before changing the member workspace or running worklist items.
- Use `<knowledge_dir>/workspace/<member-id>/local/WORKLIST.md` as the local worklist for executable or nearly executable personal work.
- Use `<knowledge_dir>/workspace/<member-id>/local/logs/YYYY-MM-DD.md` as the local daily execution log.
- Use `<knowledge_dir>/workspace/<member-id>/local/scratch/` for raw observations, rough notes, and inbox-style captures that are not yet executable.
- Use `<knowledge_dir>/workspace/<member-id>/local/drafts/` for structured personal drafts that may later be promoted.
- Use `<agent_local_dir>/worktrees/shared/` as the reusable serial worker worktree when isolated worker execution is useful.
- Use `<agent_local_dir>/worktrees/slot-XX/` worktrees only when the user explicitly authorizes parallel subagent execution for independent work items.
- Create missing `local/`, `WORKLIST.md`, and `logs/` files on demand from `<knowledge_dir>/workspace/templates/worklist.md.tpl`.
- Treat `local/` as local-only personal state. Never stage or commit it.
- Treat `<agent_local_dir>/` as local-only Agent runtime state. Never stage or commit it.
- Do not write into another member's `local/` directory.
- Do not use `local/` content as team planning input unless it is first summarized or promoted into shared knowledge.
- Use `knowledge-capture`, `delivery-planning`, `kanban-maintenance`, `delivery-implementation`, or review skills when the selected item crosses into their ownership.

## Modes

Select the mode from the user's wording:

- `capture`: route a note, idea, task, reminder, or follow-up to `scratch/`, `drafts/`, or `WORKLIST.md` based on executability.
- `intake-task`: convert an assigned or selected accepted Kanban card into local WORKLIST execution items.
- `run-next`: continue, run the next item, or start work from the worklist.
- `run-loop`: process multiple executable `Active` items under an explicit loop budget; may use parallel subagents only when the user explicitly authorizes parallel execution.
- `run-goal`: coordinate existing task/worklist skills to advance one or more accepted Kanban tasks toward review readiness within an explicit goal, scope, budget, and approval mode.
- `plan-only`: validate and plan selected work items without applying changes.
- `groom`: organize, clean up, split, merge, or prioritize the worklist.
- `resume`: restore context from the worklist and recent logs.
- `log`: record started, progress, paused, completed, blocked, or follow-up notes.

## Workflow

1. Determine current member id with `git config user.name`.
2. Read relevant sections from `<knowledge_dir>/members/<member-id>.md` if public member context is needed. Avoid full-file reads unless editing, auditing, or resolving ambiguity.
3. Read `<knowledge_dir>/workspace/<member-id>/local/AGENTS.md` if it exists. Treat it as subordinate to root `AGENTS.md`, workflow rules, schemas, task acceptance criteria, safety, privacy, approval, local-only, and review rules.
4. Ensure the local worklist exists.
5. Read `<knowledge_dir>/README.md` and `<knowledge_dir>/schemas/workspace.md`, then load the relevant reference:
    - `references/worklist-format.md` for worklist edits.
    - `references/log-format.md` for execution logs.
    - `references/routing.md` for deciding whether to stay local, promote, or intake a team task.
    - `references/execution.md` for `run-next`, `run-loop`, subagents, and shared worker worktree rules.
    - `references/worktree-lifecycle.md` before using `<agent_local_dir>/worktrees/shared/`.
6. For `run-next`, `run-loop`, and `run-goal`, classify selected work item or Kanban task validity before implementation.
7. Briefly report the selected item and validity result before making substantial changes.
8. Make the smallest local worklist/log edit needed for the mode.
9. If the work should become team knowledge or a formal task, propose the promotion path instead of hiding it in `local/`.
10. Before any staging or commit, verify `local/` and `<agent_local_dir>/` files are not staged.

## Guardrails

- Keep `WORKLIST.md` lightweight. Do not add YAML frontmatter or per-item metadata blocks.
- Add a Foam/Obsidian block anchor only when an item is first executed, logged, split for execution, or needs cross-day tracking.
- Default work item id format: `^wl-YYYYMMDD-xxxx`, where `xxxx` is a short lowercase alphanumeric suffix.
- Default raw captures to `scratch/`, structured personal drafts to `drafts/`, and only executable or nearly executable work to `WORKLIST.md#Later` unless the user asks to make it active.
- For `intake-task`, preserve source links to the Kanban card, task item, requirement, or design resource in the WORKLIST item and log.
- Treat `intake-task` as starting execution only when the work item is placed into an executable section such as `Active`; planning-only decomposition must not move the Kanban card to `Doing`.
- If intake or execution finds unresolved upstream dependencies, stop before implementation and propose task metadata or Kanban maintenance through the owning skill.
- Do not intake work assigned to another member unless the user explicitly confirms taking it.
- Run only the topmost executable `Active` item unless the user explicitly allows continuing.
- Use `run-loop` only when the user explicitly asks to continue automatically, process multiple Active items, or sets a loop budget.
- Use `run-goal` only for task/worklist execution goals. It is not an open-ended research, discovery, or autonomous product-goal mode.
- `run-loop` is serial by default. Do not run multiple work items in parallel unless the user explicitly authorizes parallel subagent execution and a parallel budget.
- `run-goal` must delegate task selection to `next-task-selection`, board changes to `kanban-maintenance`, local intake/execution to workspace-worklist modes, and review judgment to `delivery-review`.
- Parallel execution is allowlisted, not denylisted. Before parallel execution, collect candidate `Active` items, validate each item, classify task type and risk, check dependencies and likely file/resource conflicts, then dispatch only items that meet all parallel eligibility conditions in `references/execution.md`.
- Treat a WORKLIST item as the main task and allow at most one subtask layer. If user text contains deeper nesting, treat deeper bullets as details of the second-level subtask.
- Planning, execution, and review subagents are optional load reducers. The main Agent decides when to use them and remains responsible for queue selection, dependency analysis, scope, approvals, integration, logs, and final decisions.
- Use `plan-only` when the user asks to plan without implementation, requests a dry run, or when the main Agent decides implementation needs user review first.
- If Superpowers worktree or subagent skills are available, align them with this workflow's `<agent_local_dir>/worktrees/` rules and main-Agent ownership boundaries; do not let them bypass approval, local-only, log, review, or Kanban rules.
- Before running an `Active` item, check whether it is obsolete, already done elsewhere, contradicted by current project knowledge, blocked by a withdrawn requirement, or superseded by newer work. If invalid, do not implement it; move or mark it appropriately and log the reason.
- When `run-loop` cannot complete an item, classify the stop reason as `needs-user`, `blocked`, `out-of-scope`, `failed`, or `done-with-warnings`; log it, update the worklist state, and stop at unsafe boundaries.
- Use soft grooming limits: suggest cleanup when `Active` has more than five items, `Waiting` lacks reasons, or `Done` is long enough to merit a summary.
- Log key events only. Avoid recording every command, file read, search, or transient thought.
- If an item affects team Kanban, formal task items, schema, commits, or another member's workspace, stop for confirmation or route to the owning skill.
- Keep execution details in logs, not in worklist item metadata.
- If a worker subagent edits outside the approved scope, fails validation, or leaves state unclear, stop the loop and ask for user direction.
- Worker subagents must route approval or elevated-execution needs back to the main Agent. They must not self-approve elevated execution, dependency installation, deletion, publishing, commits, migrations, or team-status changes.
- When a run has a deadline, stop starting new work at the deadline, finish or pause the current atomic step safely, write the local log, update WORKLIST state, and preserve enough context to resume.

## References

- Worklist format: `references/worklist-format.md`
- Log format: `references/log-format.md`
- Routing and promotion: `references/routing.md`
- Execution and subagents: `references/execution.md`
- Shared worktree lifecycle: `references/worktree-lifecycle.md`
