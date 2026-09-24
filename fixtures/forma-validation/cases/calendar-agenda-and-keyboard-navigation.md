---
schemaVersion: 1
kind: validation-case
title: Calendar Agenda and Keyboard Navigation
summary: Validates civil-date ranges, classification, unscheduled entries, complete Agenda access, and keyboard navigation.
status: active
priority: P1
area: calendar
surfaces:
    - Calendar View
    - Agenda
automation: partial
sampleRefs:
    - "samples/projections/temporal-design"
    - "samples/projections/temporal-review"
    - "samples/projections/temporal-unscheduled"
    - "samples/projections/temporal-point"
viewPaths:
    - ".forma/views/temporal-calendar.md"
operations:
    - view.render
    - serve
assertionIds:
    - CALENDAR-001
    - CALENDAR-002
    - CALENDAR-003
    - CALENDAR-004
tags:
    - calendar
    - agenda
    - keyboard
    - civil-date
---

# Calendar Agenda and Keyboard Navigation

## Purpose

Validate explicit civil-date projection, configured classification, and complete event access across month and Agenda presentations.

## Preconditions

- `forma view render temporal-calendar --json` passes.
- Open `Temporal Validation Calendar` in the WebApp.

## Steps

1. Inspect the October 2026 month grid and compare the multi-day and single-day entries with their authored dates.
2. Open a populated date's complete event list and confirm the classification label and color cue.
3. Switch to Agenda and inspect scheduled entries and Unscheduled.
4. At a narrow viewport, use the Agenda as the default presentation and traverse events with the keyboard.
5. Use the month heading's native date control; apply a month with Enter and cancel another draft with Escape.

## Expected Results

- **CALENDAR-001:** Civil-date end dates are inclusive; a missing end occupies one day.
- **CALENDAR-002:** Entries with no start remain discoverable in Unscheduled.
- **CALENDAR-003:** Agenda and the date drawer expose the complete event list with classification text; color is not the only cue.
- **CALENDAR-004:** Keyboard traversal and month selection work without losing focus or silently applying a cancelled draft.

## Evidence

Record CLI event/count and classification output, one month grid, a complete date drawer, the Agenda including Unscheduled, and keyboard focus and month-control behavior.

## Known Limitations

This case validates read-only date projections and does not test schedule editing.

## Related Case

Continue with [[cases/gantt-dependencies-and-complete-list]].
