---
name: next-task-selection
description: Select the next accepted delivery task from Kanban. Use for dependency-aware Ready/Backlog recommendations before implementation starts.
---

# Next Task Selection

Use this skill to recommend the next accepted delivery task from `knowledge/planning/KANBAN.md`. This skill is read-only by default.

## Workflow

1. Determine the current member id with `git config user.name`.
2. Read `Responsibilities` and `Focus Areas` from `knowledge/members/<member-id>.md` when present; read `Availability` only when the user asks for capacity-aware selection.
3. Read `knowledge/workspace/<member-id>/local/AGENTS.md` only when the user asks for automatic start, personal execution preferences, or a member-personal recommendation. Use it only as a preference signal.
4. Read `knowledge/planning/KANBAN.md`.
5. Read `knowledge/tasks/WORKFLOW.md`.
6. Read `knowledge/schemas/tasks.md`.
7. Prefer `Ready` cards over `Backlog` cards.
8. Open each candidate's linked task item.
9. Exclude localized files, local-only notes, archived notes, cards in `Blocked`, and tasks with unresolved `blocked_by` entries.
10. Partition eligible candidates by assignment:
    - tasks where `assignees` includes the current member id
    - tasks with missing or empty `assignees`
    - tasks assigned only to other members
11. Build a lightweight dependency view from `blocked_by` and `related_to`; derive downstream unlock potential by reverse-looking up tasks blocked by each candidate.
12. Rank candidates inside each partition by priority, value, readiness, downstream unlock effect, risk reduction, effort fit, owners fit, member profile fit, personal preferences when loaded, and current Kanban state.
13. Recommend one next task from the first non-empty partition.
14. Report blockers, missing metadata, and any task that looks ready but is not in `Ready`.

Normalize member and group wikilinks in `owners`, `assignees`, and `reviewers` before matching. For example, `[[Gavroche]]` and `[[Gavroche|Display Name]]` both match id `Gavroche`.

## Selection Rules

- Select only accepted Kanban cards from `knowledge/planning/KANBAN.md`.
- Do not recommend loose task items from `knowledge/tasks/items/**` that are not linked from a Kanban card.
- Use linked task items only as context for the selected or candidate Kanban cards.
- If the user asks to rank task items, backlog candidates, or work not yet on the Kanban board, route to `delivery-planning` instead of selecting it for implementation.
- Do not start implementation unless the user explicitly asks.
- Do not move cards; use `kanban-maintenance` after maintainer approval.
- Treat `blocked_by` as a hard blocker unless all referenced tasks are `Done` or the blocker is documented as resolved.
- For ordinary recommendations, do a lightweight source stability check: flag obvious uncommitted changes to the task item or directly linked local source files, but do not scan every transitive dependency or query remotes for every candidate.
- For the top recommendation, automatic start, or a proposed move to `Doing`, run the full source stability check: the task item and required local source files must be committed; if a default remote exists, their commits must be pushed to that remote.
- Check required source material from the task item, `## Sources`, `blocked_by`, design links, product requirements, architecture decisions, acceptance criteria, and linked assets. Treat `related_to` as optional context unless the task body says it is required.
- Allow external stable sources only when the task records the URL, access condition, and relevant version or date.
- Do not select cards from `Blocked`, `Doing`, `Reviewing`, `Done`, or `Cancelled` unless the user explicitly asks for recovery, blocker-resolution, review, or cleanup work.
- Treat `related_to` as context only, not a blocker.
- Treat downstream tasks whose `blocked_by` references the candidate as a value signal, especially when those downstream tasks are high priority.
- Prefer smaller ready tasks when two candidates have similar value and priority.
- First search tasks assigned to the current member id in `assignees`.
- If none are eligible, search unassigned tasks with missing or empty `assignees`.
- If none are eligible, list several tasks assigned to other members as candidates, ordered by priority and value, but do not recommend starting them unless the user explicitly asks.
- Treat group assignees, including the manifest `default_group_id`, as team-pool assignment rather than assignment to the current member.
- Treat `owners` as durable responsibility, not current assignment.
- Do not let member profile sections or local `AGENTS.md` override task metadata, dependencies, readiness, approval, safety, or review rules.

## Auto-Start Rules

- If the user explicitly says the Agent may automatically start, the Agent may start the recommended task from `assigned-to-current-member` or `unassigned` according to the user's stated mode.
- Tasks in `assigned-to-others` always require a second explicit user confirmation before starting, even when the user allowed automatic start.
- Automatic start is allowed only when the selected task has `readiness: ready`, no unresolved `blocked_by` entries, clear acceptance criteria, committed and remote-synced source material when a default remote exists, and no conflict with current dirty worktree changes.
- Automatic start must stop if the task appears to require secrets, private customer data, or private personal information.
- If automatic start is allowed and the selected card must move to `Doing`, propose or apply the move only under the approval rules in `kanban-maintenance`.
- If the user's automatic-start permission is ambiguous, recommend the task and ask before starting implementation.

## Output

- Recommended next task with source link.
- Short rationale.
- Ranking table.
- Assignment partition used: `assigned-to-current-member`, `unassigned`, or `assigned-to-others`.
- Auto-start decision: `started`, `needs confirmation`, or `recommendation only`.
- Blocked or metadata-problem tasks.
- Suggested board move, if any, as a proposal only.
- Source stability status: `verified`, `needs verification`, or `not ready`.

## References

- For scoring and metadata examples, read `references/scoring.md`.
