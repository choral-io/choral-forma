---
schemaVersion: 1
kind: validation-case
title: Workspace Navigation and Quick Open
summary: Validates configured collection and file navigation, long and multilingual labels, filtering, keyboard control, and single-route activation.
status: active
priority: P0
area: workspace
surfaces:
    - Home
    - Files
    - Workspace
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

1. Open Home at `/`, then open the collection index at `/~`. In the sidebar's Workspace section, open `Spaces` and visit both configured terms. In the Files section, expand `samples/navigation` and open the sample whose title starts with `Quick Open — Extremely Long Result Label`.
2. Open Quick Open and filter with `quick` and `QUICK`, then use `知识条目` and `ナビゲーション` to find the mixed-language sample.
3. Move through results with Arrow Up and Arrow Down, then activate one result with Enter.
4. Tab to the Quick Open trigger and press Enter. Press Escape and confirm focus returns to the trigger.
5. Repeat at a narrow viewport and navigate through the mobile dialog.

## Expected Results

- **NAV-001:** The collection index lists `Spaces`. The Workspace tree links `Validation Cases` to `/~/spaces/cases` and `Validation Samples` to `/~/spaces/samples`. The Files tree opens the sample at `/samples/navigation/quick-open-long-label.md`.
- **NAV-002:** Filtering is case-insensitive and supports Unicode labels without truncating the match target.
- **NAV-003:** Enter causes exactly one route transition to the selected entry.
- **NAV-004:** Escape and mobile navigation close the active dialog and restore a usable focus target.

## Evidence

Record the viewport, selected result path, final route, keyboard sequence, and any console error.

## Known Limitations

This case does not validate authenticated or remote workspaces.

## Related Case

Continue with [[cases/markdown-reader-rich-content]].
