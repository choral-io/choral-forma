---
scope: project
type: process
owners:
    - "[[groups/{{default_group_id}}]]"
tags:
    - collaboration
    - workflow
    - kanban
---

# Collaboration Workflow

This document is the end-to-end map for repository-backed knowledge and delivery. Detailed task, Kanban, and readiness rules live in `{{knowledge_dir}}/tasks/WORKFLOW.md`.

## Operating Model

```text
member workspace -> project knowledge -> task item -> Kanban -> implementation -> review -> updated knowledge
```

| Area                  | Source of truth                               | Notes                                            |
| --------------------- | --------------------------------------------- | ------------------------------------------------ |
| Project facts         | `{{knowledge_dir}}/` canonical files and code | Canonical-language files are authoritative.      |
| Personal work context | `{{knowledge_dir}}/workspace/<member-id>/`    | Context, not team consensus.                     |
| Delivery status       | `{{knowledge_dir}}/planning/KANBAN.md`        | Board edits require approved Kanban maintenance. |
| Task context          | `{{knowledge_dir}}/tasks/items/*.md`          | Kanban cards should link to task items.          |
| Localized content     | `*.<locale>.md`                               | Translations only; not sources of new facts.     |

When sources conflict, apply precedence from `{{knowledge_dir}}/schemas/common.md`. Local notes and current conversation can trigger updates, but they do not replace canonical knowledge until approved capture or maintenance happens.

## Required Reads

- Before writing knowledge, read `{{knowledge_dir}}/schemas/common.md` and the target area schema.
- Before changing delivery cards, read `{{knowledge_dir}}/tasks/WORKFLOW.md`.
- Determine the current member id with `git config user.name`; do not infer it from the OS, shell, machine, or chat name.

## Workflow Stages

1. Capture raw personal context in the current member's `local/` workspace. Do not store secrets, private notes, or customer-sensitive data.
2. Route durable material through `knowledge-intake`; write only approved shared or canonical updates through `knowledge-capture`.
3. Use `proposals/` for valuable but unconfirmed knowledge, task, or decision candidates. Accepted proposals must be converted before they become facts or delivery inputs.
4. Put durable project material in the matching canonical area: `discovery/`, `product/`, `design/`, `concepts/`, `architecture/`, `decisions/`, `guidelines/`, `planning/`, or `tasks/items/`.
5. Shape delivery candidates as task items with clear sources, scope, acceptance criteria, readiness, and ownership metadata.
6. Use `delivery-planning` for dry-run board proposals and `kanban-maintenance` only after explicit approval.
7. Use `next-task-selection` for accepted Kanban cards; loose task items are planning candidates, not selected work.
8. Use `workspace-worklist` when a member takes accepted work into local execution.
9. Use `delivery-implementation` for code, tests, and required knowledge updates.
10. Use `delivery-review` before `Done` when implementation, acceptance criteria, source knowledge, or checks changed.

## Knowledge Areas

| Area             | Use for                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `discovery/`     | market, customer, competitor, business, assumption, and research context |
| `product/`       | product behavior, requirements, flows, prototypes, and IA                |
| `design/`        | UI design, interaction states, layout, visual rules, design systems      |
| `assets/design/` | design images, exports, and supporting visual assets                     |
| `concepts/`      | glossary terms, domain concepts, and shared mental models                |
| `architecture/`  | modules, APIs, data flow, integrations, configuration, operations        |
| `decisions/`     | accepted product or technical tradeoffs and supersessions                |
| `guidelines/`    | cross-area writing, terminology, language, documentation, process        |
| `proposals/`     | optional review buffer for unconfirmed candidates                        |
| `tasks/items/`   | durable delivery task context and acceptance criteria                    |

## Delivery Summary

- `{{knowledge_dir}}/planning/KANBAN.md` tracks delivery status.
- Cards stay thin and link to task items.
- Board movement requires explicit approved `kanban-maintenance`.
- `Backlog` and `Ready` are candidate pools; `Doing`, `Reviewing`, `Blocked`, `Done`, and `Cancelled` have explicit state meaning in `{{knowledge_dir}}/tasks/WORKFLOW.md`.
- `Done` requires delivered work, relevant checks or documented skips, updated durable knowledge when needed, local execution closure, delivery review acceptance, and approved board movement.

## Optional Superpowers Guidance

When Superpowers skills are available, use them only as optional execution-method support:

| Workflow need                                           | Optional Superpowers skill                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| shape unclear work                                      | `superpowers:brainstorming`                                                  |
| write implementation plan                               | `superpowers:writing-plans`                                                  |
| feature, bugfix, refactor, or behavior change           | `superpowers:test-driven-development`                                        |
| unclear failure                                         | `superpowers:systematic-debugging`                                           |
| verify completion, commit, PR, or Done-readiness claims | `superpowers:verification-before-completion`                                 |
| isolated or authorized parallel Agent execution         | `superpowers:using-git-worktrees`, `superpowers:subagent-driven-development` |

Knowledge Workflow remains authoritative for knowledge placement, task items, Kanban state, WORKLIST ownership, approval gates, and delivery review. Superpowers plans should stay under `{{knowledge_dir}}/workspace/<member-id>/local/drafts/` unless approved for promotion; runtime worktrees belong under `{{agent_local_dir}}/worktrees/`.

## Localized Versions

`canonical_language: {{canonical_language}}` in `{{knowledge_dir}}/.workflow/manifest.yml` is the source language for canonical knowledge. Localized files may help readers but must declare translation metadata and must not introduce new facts, decisions, requirements, or delivery status.

## Agent Rules

Agents working in this workflow must:

- preserve repository safety and root `AGENTS.md` instructions;
- use schemas before writing knowledge;
- use the task workflow before delivery changes;
- keep `workspace/<member-id>/local/` and `{{agent_local_dir}}/` local-only;
- avoid localized files and local-only notes as planning inputs;
- stop and report secrets, sensitive data, or scope conflicts;
- keep cards concise and link to source knowledge;
- update durable product, discovery, design, architecture, decision, or guideline knowledge when delivery changes it.
