---
schemaVersion: 1
kind: validation-case
title: Table Overflow and Sticky Header
summary: Validates wide configured and Markdown tables, local horizontal scrolling, sticky header geometry, and projection boundaries.
status: active
priority: P0
area: table
surfaces:
    - Table View
    - Reader
automation: partial
sampleRefs:
    - "samples/projections/wide-table-overflow"
    - "samples/projections/variable-kanban-header"
    - "samples/projections/graph-reference-density"
    - "samples/workspace/workspace-config-inspection"
viewPaths:
    - ".forma/views/wide-table.md"
operations:
    - view.render
    - serve
assertionIds:
    - TABLE-001
    - TABLE-002
    - TABLE-003
    - TABLE-004
tags:
    - table
    - sticky
    - overflow
    - responsive
---

# Table Overflow and Sticky Header

## Purpose

Validate both configured Table projection behavior and ordinary Markdown table containment using deliberately wide and variable content.

## Preconditions

- `forma view render wide-table --json` passes.
- Open the `Wide Table Pressure` view in the WebApp.

## Steps

1. Scroll vertically until the projection header reaches its sticky position.
2. Scroll the local horizontal rail to both extremes.
3. Resize the viewport until labels and values wrap differently.
4. Continue vertically past the projection boundary.
5. Repeat the local overflow check on the Markdown table in the Reader showcase.

## Expected Results

- **TABLE-001:** Horizontal scrolling remains owned by the table region rather than the route root.
- **TABLE-002:** Header cells stay aligned with body columns throughout horizontal movement.
- **TABLE-003:** Sticky geometry remains correct after wrapping and viewport changes.
- **TABLE-004:** The header stops sticking outside the projection boundary.

## Evidence

Capture left, middle, and right horizontal positions at wide and narrow widths, including the projection boundary.

## Known Limitations

This case validates read-only projections and does not cover column resizing or editing.

## Related Case

Continue with [[cases/kanban-overflow-and-sticky-header]].
