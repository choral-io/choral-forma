---
schemaVersion: 1
kind: validation-case
title: Responsive Shell and Theme
summary: Validates desktop sidebar state, mobile Drawer and FAB lifecycle, focus return, theme modes, and page-root overflow containment.
status: active
priority: P0
area: shell
surfaces:
    - Application Shell
    - Mobile Navigation
    - Theme Control
automation: partial
sampleRefs:
    - "samples/navigation/mobile-navigation-dialog"
    - "samples/projections/reader-theme-adaptation"
    - "samples/workspace/healthy-workspace-baseline"
viewPaths:
    - ".forma/views/case-matrix.md"
    - ".forma/views/wide-table.md"
    - ".forma/views/variable-height-kanban.md"
    - ".forma/views/workspace-graph.md"
operations:
    - serve
assertionIds:
    - SHELL-001
    - SHELL-002
    - SHELL-003
    - SHELL-004
tags:
    - responsive
    - drawer
    - focus
    - theme
---

# Responsive Shell and Theme

## Purpose

Validate the shell lifecycle around the same Reader and projection routes at desktop and mobile widths.

## Preconditions

- Serve the fixture workspace.
- Test at approximately 1440 px and 390 px viewport widths.

## Steps

1. Collapse and expand the desktop sidebar while a projection is visible.
2. At mobile width, open navigation with the FAB and close it with backdrop and Escape.
3. Reopen the mobile dialog and navigate to another Sample or View.
4. Switch between light, dark, and system theme modes.
5. Visit the Reader, Table, Kanban, and Graph pressure routes and check root overflow.

## Expected Results

- **SHELL-001:** Desktop sidebar state changes do not obscure or permanently mis-size the route content.
- **SHELL-002:** Mobile backdrop, Escape, and successful navigation close the dialog through one lifecycle.
- **SHELL-003:** Focus returns to a usable trigger or moves to the navigated content.
- **SHELL-004:** Theme selection remains coherent across routes and no pressure route widens the page root.

## Evidence

Capture both viewports in light and dark modes, record the focused element after close, and check root `scrollWidth`.

## Known Limitations

This first batch does not cover browser zoom levels above the default accessibility smoke range.

## Related Case

Return to [[cases/workspace-navigation-and-quick-open]].
