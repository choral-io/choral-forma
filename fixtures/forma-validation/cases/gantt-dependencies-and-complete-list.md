---
schemaVersion: 1
kind: validation-case
title: Gantt Dependencies and Complete List
summary: Validates offset datetimes, progress, milestone semantics, dependency direction, unscheduled nodes, keyboard traversal, and the complete list.
status: active
priority: P1
area: gantt
surfaces:
    - Gantt View
    - Static HTML
automation: partial
sampleRefs:
    - "samples/projections/temporal-design"
    - "samples/projections/temporal-review"
    - "samples/projections/temporal-unscheduled"
    - "samples/projections/temporal-point"
viewPaths:
    - ".forma/views/temporal-gantt.md"
operations:
    - view.render
    - serve
assertionIds:
    - GANTT-001
    - GANTT-002
    - GANTT-003
    - GANTT-004
    - GANTT-005
tags:
    - gantt
    - datetime
    - dependencies
    - keyboard
---

# Gantt Dependencies and Complete List

## Purpose

Validate the read-only datetime timeline and its complete node, interval, and predecessor information.

## Preconditions

- `forma view render temporal-gantt --json` passes.
- Open `Temporal Validation Gantt` in the WebApp.

## Steps

1. Compare each scheduled row with its RFC 3339 start/end values and workspace timezone.
2. Inspect progress fills, including the authored zero, and confirm the milestone marker.
3. Follow the anchored finish-to-start connector from design to review, then inspect the unscheduled follow-up's predecessor relationship in the complete list.
4. Use arrow keys, Page Up/Down, Home, and End to traverse rows; select rows without changing the horizontal date position.
5. Inspect the complete node/interval/predecessor list and confirm the unscheduled entry remains represented.

## Expected Results

- **GANTT-001:** Offset datetimes normalize to days in the workspace timezone and exclusive datetime ends remain exclusive.
- **GANTT-002:** Progress is shown as an authored whole percent and does not alter interval geometry; zero differs from absent.
- **GANTT-003:** A configured true milestone is marked, while ordinary point intervals are not inferred as milestones.
- **GANTT-004:** Each declared predecessor points from predecessor to successor; the dedicated predecessor field supplies these edges.
- **GANTT-005:** Keyboard traversal keeps the selected row usable; the complete list includes unscheduled nodes and predecessor details without inventing a bar or connector for an unanchored dependency.

## Evidence

Record candidate/scheduled counts, node progress and milestone values, edge endpoints/status, keyboard traversal, and the full list contents.

## Known Limitations

The fixture does not assert scheduling conflicts, lag calculations, critical paths, or write-back.

## Related Case

Start with [[cases/calendar-agenda-and-keyboard-navigation]].
