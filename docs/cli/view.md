---
id: cli.view
title: forma view
summary: Render configured workspace views.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma view render
order: 70
---

# forma view

## Overview

`forma view render <view-id-or-path> --json` renders a configured view as a read-only projection over workspace content.

## CLI Help

Use this command for configured lists, tables, kanban boards, graphs, calendars, and Gantt timelines. A view locator may be a configured view id such as `.forma/views/task-board`, or the matching Markdown path such as `.forma/views/task-board.md`.

Gantt returns `render.kind: gantt`, `timeZone`, `counts`, `nodes`, `rows`, and `edges`. Nodes cover every selected candidate and own identity, status, optional classification, and dependency counts. Rows cover scheduled nodes only and contain the Calendar-compatible temporal value, `firstDate`, exclusive `afterLastDate`, and explicit `milestone`. Edges contain `from`, `to`, `relation: finishToStart`, and `anchored`/`unanchored` status; their stable ID is a compact JSON-encoded path pair. Both endpoints always resolve to nodes. Each node's `declared` count equals `predecessors.length + outsideSelection + unresolved + duplicates + selfReferences`. Core performs no pagination, implicit current-date filter, scheduling conflict evaluation or write-back. See [Gantt configuration](../workspace/views.md#gantt).

## Reference

`view.render.items[].fields` is a tagged result contract. Ordinary values use `{ "kind": "value", "value": ... }`; one resolved reference uses `{ "kind": "reference", "reference": { "path", "title" } }`; and a resolved reference list uses `{ "kind": "referenceList", "references": [...] }`. Clients must render resolved reference targets from this structure rather than re-resolving frontmatter paths.

## Agent Skill

Calendar returns `render.kind: calendar`, `timeZone`, `firstDayOfWeek`, `counts`, `events`, and `unscheduled`. Each event contains only `path`, `title`, `temporal`, `firstDate`, and `afterLastDate`. The latter two delimit a half-open range of workspace civil dates. `temporal.kind: date` contains civil `start` and `endExclusive`; `temporal.kind: datetime` contains UTC offset instants with a nullable `endExclusive` (null means a point). Unscheduled entries contain `path` and `title`.

Counts satisfy `candidates = scheduled + unscheduled + invalid` after source/query selection and existing workspace indexing validation. The projection includes all scheduled and unscheduled candidates without hidden truncation or a current-month filter. Invalid candidates have source-locatable diagnostics. Clients must use the normalized dates rather than reinterpret frontmatter. See [Calendar configuration](../workspace/views.md#calendar).

Prefer `forma view render <view-id-or-path> --json` over workflow-specific read commands when the workspace already defines a view for the workflow.
