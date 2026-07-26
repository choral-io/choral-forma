---
schemaVersion: 1
kind: validation-case
title: Workspace Navigation and Quick Open
summary: Validates taxonomy-neutral Browse navigation, long and multilingual labels, filtering, keyboard control, and single-route activation.
status: active
priority: P0
area: workspace
surfaces:
    - Home
    - Browse
    - Quick Open
automation: partial
sampleRefs:
    - "samples/navigation/quick-open-long-label"
    - "samples/navigation/mobile-navigation-dialog"
    - "samples/reader/multilingual-long-title"
    - "samples/workspace/healthy-workspace-baseline"
viewPaths:
    - ".forma/views/case-matrix.md"
operations:
    - config.inspect
    - list
    - inspect
    - serve
assertionIds:
    - NAV-001
    - NAV-002
    - NAV-003
    - NAV-004
tags:
    - navigation
    - quick-open
    - keyboard
---

# Workspace Navigation and Quick Open

## Purpose

Confirm that the WebApp exposes configured taxonomy and entry titles without inferring repository-specific semantics, and that Quick Open remains usable with mixed-language and long labels.

## Preconditions

- `forma check --json` passes in this workspace.
- The WebApp is served from this workspace.
- The four referenced Samples are discoverable in the `samples` space.

## Steps

1. Open Home and Browse, then navigate to both configured spaces.
2. Open Quick Open and filter with `quick`, `移动`, and `境界`.
3. Move through results with Arrow Up and Arrow Down, then activate one result with Enter.
4. Close Quick Open with Escape and confirm focus returns to its trigger.
5. Repeat at a narrow viewport and navigate through the mobile dialog.

## Expected Results

- **NAV-001:** Browse presents `Validation Cases` and `Validation Samples` as configured terms.
- **NAV-002:** Filtering is case-insensitive and supports Unicode labels without truncating the match target.
- **NAV-003:** Enter causes exactly one route transition to the selected entry.
- **NAV-004:** Escape and mobile navigation close the active dialog and restore a usable focus target.

## Evidence

Record the viewport, selected result path, final route, keyboard sequence, and any console error.

## Known Limitations

This case does not validate authenticated or remote workspaces.

## Related Case

Continue with [[cases/markdown-reader-rich-content]].
