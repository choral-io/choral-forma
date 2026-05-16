# Next Task Selection Scoring

## Candidate Sources

Default candidate source is accepted cards in `knowledge/planning/KANBAN.md`.
Use linked task items only as context for those cards.

Default Kanban scan order:

1. `Ready`
2. `Backlog`

Do not select cards from `Doing`, `Reviewing`, `Done`, or `Cancelled` unless the user asks for recovery or review work.

Do not select cards from `Blocked` for implementation. Use blocked cards only when the user asks for unblock or recovery work.

Do not select loose task items from `knowledge/tasks/items/**` unless they are linked from a candidate Kanban card. If the user asks to rank task items that are not on the board, route to `delivery-planning`.

## Metadata

Task items may include:

```yaml
priority: P1
value: H
effort: M
readiness: ready
module: app
owners:
  - "[[Gavroche]]"
assignees:
  - "[[Gavroche]]"
reviewers:
  - "[[Éponine]]"
blocked_by:
  - "[[tasks/items/example-upstream-task]]"
related_to:
  - "[[tasks/items/example-related-task]]"
unblocks:
  - "[[tasks/items/example-downstream-task]]"
```

Use task knowledge-reference wikilinks in relationship fields, not display titles. Tool-written values should prefer path-qualified task wikilinks.

## Field Meanings

- `priority`: team priority. Suggested values: `P0`, `P1`, `P2`, `P3`.
- `value`: expected product or engineering value. Suggested values: `H`, `M`, `L`.
- `effort`: expected implementation size. Suggested values: `S`, `M`, `L`.
- `readiness`: execution readiness. Suggested values: `ready`, `needs-refinement`, `blocked`.
- `assignees`: member wikilinks for people currently responsible for moving the task forward.
- `reviewers`: member wikilinks for expected reviewers for delivery acceptance.
- `blocked_by`: hard blockers that prevent work from starting.
- `related_to`: useful context or adjacent work, not a blocker.
- `unblocks`: tasks that become easier or possible after this task is done.

## Assignment Priority

Apply assignment priority before normal ranking:

1. Tasks where `assignees` includes the current member id.
2. Tasks with missing or empty `assignees`.
3. Tasks assigned only to other members.

Only recommend from the first non-empty eligible group. If only tasks assigned to other members remain, list them as candidates and state that reassignment or explicit approval is needed before starting.

Normalize member and group wikilinks before matching assignment. For example, `[[Gavroche]]` and `[[Gavroche|Display Name]]` both match id `Gavroche`. Group assignees, including the manifest `default-group-id`, mean team-pool assignment and do not match the current member.

Within each assignment group, rank by the heuristics below.

## Auto-Start

If the user explicitly allows automatic start, the Agent may proceed only for:

- `assigned-to-current-member`
- `unassigned`

For `assigned-to-others`, the Agent must ask for a second explicit confirmation before starting. This protects another member's active work even when general automatic start is enabled.

## Ranking Heuristics

Rank candidates higher when they:

- Have higher `priority`.
- Have higher `value`.
- Are in `Ready`.
- Have `readiness: ready`.
- Have no unresolved `blocked_by` entries.
- Unblock high-priority or multiple downstream tasks.
- Reduce product, technical, or delivery risk early.
- Fit the requested module.
- Have lower effort when value and priority are similar.

Rank candidates lower or exclude them when they:

- Have unresolved `blocked_by` entries.
- Have missing acceptance criteria.
- Have `readiness: needs-refinement` or `readiness: blocked`.
- Are in the `Blocked` column, unless the user asked for unblock work.
- Depend on localized files or local workspace notes as their only source.
- Have unclear scope or sensitive information.

## Output Example

```text
Recommended next task: Example delivery task

Reason:
- P1 with high product value.
- No unresolved `blocked_by` entries.
- Unblocks downstream delivery work.
- Small enough for a focused implementation pass.

Alternatives:
1. Example documentation task
2. Example integration task

Blocked:
- Example downstream task: blocked by example-upstream-task
```
