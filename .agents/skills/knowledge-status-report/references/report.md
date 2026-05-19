# Report Guidance

## Metric Basis

Label each reported metric by how it was derived:

| Basis         | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `field-based` | Counted from explicit frontmatter or schema-defined fields.    |
| `board-based` | Counted from `planning/KANBAN.md` columns or linked cards.     |
| `git-based`   | Counted from committed file history or recent changed files.   |
| `inferred`    | Estimated from prose, links, headings, or partial conventions. |

Prefer `field-based` and `board-based` metrics. Use `inferred` only when the user needs a directional report and the limitation is clearly stated.

## Scope

Use the narrowest useful scope:

| Scope             | Use when                                                                               |
| ----------------- | -------------------------------------------------------------------------------------- |
| `project-wide`    | The user asks broadly how the project or knowledge base is doing.                      |
| `discovery-only`  | The user asks about research, analysis, assumptions, opportunities, or market context. |
| `delivery-only`   | The user asks about Kanban, tasks, blockers, review, or Done work.                     |
| `product-only`    | The user asks about requirements, product scope, or delivered product behavior.        |
| `member-specific` | The user names a member, assignee, reviewer, owner, or handoff recipient.              |
| `sprint-specific` | The user names a sprint, milestone, planning period, or date-bounded delivery window.  |
| `module-specific` | The user names a module, component, feature area, or knowledge area.                   |

Default to `project-wide` only when the user does not imply a narrower scope.

For non-standard statistics, keep the nearest scope and add a filter or facet:

| Request                              | Scope             | Filter or facet                          |
| ------------------------------------ | ----------------- | ---------------------------------------- |
| "design resource status"             | `project-wide`    | `knowledge-area: design`                 |
| "architecture debt"                  | `project-wide`    | `risk-area: architecture`                |
| "handoff items"                      | `project-wide`    | `workspace-area: handoffs`               |
| "open proposals"                     | `project-wide`    | `proposal_status: proposed or reviewing` |
| "accepted but unconverted proposals" | `project-wide`    | `proposal_status: accepted`              |
| "external dependency blockers"       | `delivery-only`   | `blocked_by: external-dependency`        |
| "review load for one component"      | `module-specific` | `facet: reviewers`                       |

## Reliability

Assign one report-level reliability:

| Reliability | Meaning                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `high`      | Core metrics use explicit fields, Kanban columns, stable links, or git history.                              |
| `medium`    | Most metrics are explicit, but some important areas use inference or incomplete schemas.                     |
| `low`       | The report depends heavily on prose inference, missing metadata, local-only material, or inconsistent links. |

Explain the main reason when reliability is `medium` or `low`.

## Useful Counts

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

Ownership:

- owners by area
- group-owned areas, including the manifest `default_group_id`
- assignees by active delivery state
- reviewers by Reviewing work
- unowned or single-owner high-risk areas

Risks:

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
| Ready cards       | 4     | board-based | From `knowledge/planning/KANBAN.md`.                   |
| Blocked cards     | 1     | board-based | One card has no linked blocker-resolution owner.       |
| Pending decisions | 3     | inferred    | Based on headings/prose; schema support is incomplete. |

## Risks And Gaps

- Add explicit decision-state metadata if decision reporting becomes routine.
- Run `task-metadata-audit` before promoting Ready candidates.

## Sources

- `knowledge/planning/KANBAN.md`
- `knowledge/tasks/items/example-task.md`
- `knowledge/decisions/example-decision.md`
```

When a metric is not reliable:

```md
Requirement delivery cannot be counted reliably yet. The product schema does not define a requirement-state field, and current files do not consistently link delivered work back to requirements.
```
