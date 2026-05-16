---
name: knowledge-status-report
description: Produce read-only repository knowledge status reports. Use for delivery progress, knowledge health, pending decisions, queues, ownership, blockers, and risks.
---

# Knowledge Status Report

Use this skill to summarize repository knowledge status without changing files.

## Modes

- `overview`: concise project knowledge and delivery summary.
- `delivery`: Kanban, task items, readiness, blockers, review queues, and Done counts.
- `decisions`: proposed, accepted, rejected, superseded, and unresolved decisions.
- `requirements`: product requirement coverage, planned work, delivered work, and gaps.
- `proposals`: open proposals, proposals by type/status, accepted proposals not yet converted, and proposal risks.
- `ownership`: owners, assignees, reviewers, and member responsibility coverage.
- `risks`: blockers, stale references, missing metadata, unclear ownership, and workflow gaps.
- `activity`: recent knowledge and delivery changes, using git history when available.

If the user does not specify a mode, use `overview`.

## Scope

Choose the narrowest useful report scope before reading broadly:

- `project-wide`: default for broad status questions.
- `discovery-only`: requirement discovery, market context, business assumptions, customer research, and environmental analysis.
- `delivery-only`: Kanban, task items, readiness, blockers, and review queues.
- `product-only`: requirements, product scope, delivery links, and product risks.
- `member-specific`: one member's public responsibilities, assignments, reviews, handoffs, and shared workspace material.
- `sprint-specific`: one sprint or planning period.
- `module-specific`: one module, component, feature area, or knowledge area.

If the user names a sprint, member, module, product area, or knowledge area, use that as the scope. If the scope is unclear and a broad read would be expensive, ask a short clarification or default to `project-wide overview` and state that assumption.

If the user asks for a statistic that does not fit a predefined scope, keep the nearest scope and express the request as a `filter` or `facet` instead of inventing a new scope or refusing the report.

## Workflow

1. Read `{{knowledge_dir}}/.workflow/manifest.yml` when present; use its `knowledge-dir`, `agent-skills-dir`, `agent-local-dir`, and `canonical-language`.
2. Read the knowledge workflow block in root `AGENTS.md`.
3. Read `{{knowledge_dir}}/README.md`, `{{knowledge_dir}}/schemas/common.md`, and the relevant schemas under `{{knowledge_dir}}/schemas/`.
4. Read only the knowledge areas needed for the requested mode.
5. Read `{{knowledge_dir}}/planning/KANBAN.md` and task items only for delivery-related modes.
6. Prefer explicit frontmatter, Kanban columns, wikilinks, and schema-defined fields over inference from prose.
7. Clearly label counts as `field-based`, `board-based`, `git-based`, or `inferred`.
8. Assign report reliability as `high`, `medium`, or `low`.
9. Report findings and recommended next actions without editing files.

## Sources By Mode

| Mode           | Primary sources                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `overview`     | README, schemas, Kanban, task items, discovery, product, decisions, planning, workspace                  |
| `discovery`    | `discovery/**`, linked product requirements, linked decisions, supporting workspace research             |
| `delivery`     | `planning/KANBAN.md`, `tasks/items/**`, issue/bug/defect metadata, `tasks/WORKFLOW.md`, sprint documents |
| `decisions`    | `decisions/**`, architecture/design/product links, supersession metadata                                 |
| `requirements` | `product/**`, `discovery/**`, linked task items, Kanban cards, delivered implementation notes            |
| `proposals`    | `proposals/**`, proposal type/status metadata, sources, targets, review decisions                        |
| `ownership`    | frontmatter `owners`, `assignees`, `reviewers`, `members/**`, Kanban cards                               |
| `risks`        | task metadata, blocked cards, missing sources, stale links, local-only sources                           |
| `activity`     | git history, recent file changes, Kanban movement evidence, work logs if shared                          |

Exclude `{{knowledge_dir}}/workspace/*/local/**` by default. Read local workspace files only when the user explicitly asks about their own local state or the mode requires current-member local context.

## Reporting Rules

- Separate facts from inference.
- Prefer counts with linked examples over long inventories.
- Include the exact source paths used.
- State the report scope and reliability near the top of the output.
- State any filter or facet used for a non-standard statistic.
- Call out missing schema support when a requested metric cannot be counted reliably.
- Do not treat localized files as canonical sources.
- Do not treat local-only notes, WORKLIST entries, or work logs as team status unless the user explicitly scopes the report to local work.
- Do not count a requirement, decision, or task as delivered only because prose suggests it; prefer linked Done cards, task metadata, or explicit delivered references.
- Do not count proposals as project facts, accepted decisions, task items, or delivery commitments.
- Count issue, bug, and defect tasks separately when severity or quality risk matters.

## Output

Use this structure unless the user asks for another format:

```md
## Status Summary

- Scope: ...
- Reliability: high | medium | low
- ...

## Counts

| Area | Count | Basis | Notes |
| ---- | ----- | ----- | ----- |

## Risks And Gaps

- ...

## Recommended Next Actions

- ...

## Sources

- ...
```

For examples and metric guidance, read `references/report.md`.

## Guardrails

- Read-only: do not edit knowledge files, task items, Kanban cards, manifests, or local worklists.
- Do not move Kanban cards or change task metadata.
- Do not run broad document migrations.
- Do not infer sensitive information.
- Route fixes to the owning skill:
  - `knowledge-schema-audit` for non-task metadata quality.
  - `task-metadata-audit` for task metadata and readiness quality.
  - `knowledge-intake` for unclear placement or promotion decisions.
  - `knowledge-capture` for approved knowledge updates.
  - `delivery-planning` for delivery planning changes.
  - `kanban-maintenance` for approved board updates.
