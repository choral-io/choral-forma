---
schemaVersion: 1
kind: validation-case
title: Kanban Overflow and Sticky Header
summary: Validates one-row columns, multiline labels, measured header height, horizontal alignment, and projection-local sticky behavior.
status: active
priority: P0
area: kanban
surfaces:
    - Kanban View
automation: partial
sampleRefs:
    - "samples/projections/variable-kanban-header"
    - "samples/navigation/quick-open-long-label"
    - "samples/workspace/repository-markdown-source"
    - "samples/workspace/healthy-workspace-baseline"
viewPaths:
    - ".forma/views/variable-height-kanban.md"
operations:
    - view.render
    - serve
assertionIds:
    - KANBAN-001
    - KANBAN-002
    - KANBAN-003
    - KANBAN-004
tags:
    - kanban
    - sticky
    - variable-height
    - overflow
---

# Kanban Overflow and Sticky Header

## Purpose

Exercise the measured Kanban presentation contract with five columns, long labels, multiline content, and cards distributed across every stage.

## Preconditions

- `forma view render variable-height-kanban --json` passes.
- Open the `Variable Height Kanban` view in the WebApp.

## Steps

1. Confirm that all five configured columns remain on one horizontal row.
2. Scroll vertically until column headers become sticky.
3. Move the horizontal rail while headers are sticky.
4. Resize between wide and narrow viewports and repeat.
5. Scroll beyond the projection boundary.

## Expected Results

- **KANBAN-001:** Columns remain horizontally scrollable and are not collapsed into an unintended vertical stack.
- **KANBAN-002:** Header height follows the tallest wrapped label instead of a fixed value.
- **KANBAN-003:** Sticky headers and card columns remain horizontally aligned.
- **KANBAN-004:** Sticky presentation ends at the configured view boundary without introducing nested vertical scrolling.

## Evidence

Capture the tallest header, the horizontal extremes, the narrow viewport, and the lower projection boundary.

## Known Limitations

Drag-and-drop mutation is outside this read-only fixture.

## Related Case

Continue with [[cases/graph-projection-and-interaction]].
