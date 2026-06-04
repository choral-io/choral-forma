# Report Areas And Examples

Use these lists and examples when choosing report areas, risk categories, or concise wording.

## Reportable Areas

Delivery:

- cards by Kanban column
- task items by `readiness`
- issue, bug, and defect task items by `severity`
- blocked cards and unresolved `blocked_by` references
- Ready tasks without assignees
- Reviewing cards waiting for reviewers
- Done cards linked to task items

Knowledge:

- documents by area and type
- canonical vs localized files
- documents missing owners
- discovery documents that support product requirements or decisions
- user stories, use cases, scenarios, and journeys by `type` and `status`
- test cases by `type`, `status`, `priority`, `automation`, and coverage links
- metrics by `type`, `status`, target, source, and review cadence
- experiments by `type`, `status`, metric links, guardrails, and follow-up decisions
- releases by `status`, version, validation links, rollout, rollback, and post-release follow-up
- shared workspace summaries, handoffs, and research items
- proposals by `proposal_type` and `proposal_status`
- local-only content excluded from team reporting

Decisions:

- accepted decisions
- proposed or pending decisions
- rejected decisions
- superseded decisions
- decisions without owners or review context

Requirements:

- accepted or approved requirements when explicit metadata exists
- requirements linked to planned or Ready work
- requirements linked to Done work
- requirements with no linked delivery path
- user stories without linked product, test case, metric, or task context
- test cases without covered user stories, product requirements, tasks, or releases
- metrics without source, target, or review cadence
- running experiments without metrics, guardrails, or follow-up owner
- releases without validation, rollback, or post-release follow-up

Ownership:

- owners by area
- group-owned areas
- assignees by active delivery state
- reviewers by Reviewing work
- unowned or single-owner high-risk areas

Risks:

- Source traceability risks: source-derived docs without `sources`, docs citing local-only material as team evidence, and converted proposals whose target docs dropped the proposal source.
- Link health risks: canonical docs with no inbound or outbound durable links, requirements without delivery links, designs without product or task links, and decisions without affected-area links.
- Product-development coverage risks: user stories without delivery or validation links, test cases without covered scope, metrics without sources or targets, experiments without metrics or guardrails, and releases without validation or rollback context.
- Proposal health risks: accepted but unconverted proposals, stale reviewing proposals, rejected proposals still referenced as facts, and proposals with no owner.
- blocked work with no clear blocker-resolution path
- Ready work with missing source material
- stale Kanban links
- tasks pointing to local-only sources
- localized files that appear to contain canonical facts
- schema fields that do not support requested reporting reliably

## Output Examples

Concise summary:

```md
## Status Summary

- Scope: project-wide
- Filter: none
- Reliability: medium. Decision status is partly inferred because decision-state metadata is not yet defined.
- Delivery is concentrated in `Ready`; no `Reviewing` cards are waiting.
- Two Ready task items lack reviewers.

## Counts

| Area              | Count | Basis       | Notes                                                  |
| ----------------- | ----- | ----------- | ------------------------------------------------------ |
| Ready cards       | 4     | board-based | From `<knowledge_dir>/planning/KANBAN.md`.             |
| Blocked cards     | 1     | board-based | One card has no linked blocker-resolution owner.       |
| Pending decisions | 3     | inferred    | Based on headings/prose; schema support is incomplete. |

## Risks And Gaps

- Add explicit decision-state metadata if decision reporting becomes routine.
- Run `task-metadata-audit` before promoting Ready candidates.

## Sources

- `<knowledge_dir>/planning/KANBAN.md`
- `<knowledge_dir>/tasks/example-task.md`
- `<knowledge_dir>/decisions/example-decision.md`
```

When a metric is not reliable:

```md
Requirement delivery cannot be counted reliably yet. The product schema does not define a requirement-state field, and current files do not consistently link delivered work back to requirements.
```
