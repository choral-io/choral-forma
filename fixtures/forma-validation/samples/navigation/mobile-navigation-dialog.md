---
schemaVersion: 1
kind: validation-sample
title: Mobile Navigation Dialog Lifecycle
summary: Route target used to validate FAB opening, backdrop and Escape closing, navigation close, and focus restoration.
stage: active
priority: P0
area: navigation
owner: "Chen Wei"
reviewer: "Fatima Zahra"
longValue: "mobile-dialog://open-with-fab/close-with-backdrop-or-escape/navigate-once/restore-focus"
tags:
    - mobile
    - dialog
    - focus
relatedSamples:
    - "samples/workspace/healthy-workspace-baseline"
    - "samples/projections/reader-theme-adaptation"
---

# Mobile Navigation Dialog Lifecycle

At a narrow viewport, navigate here from the Drawer and confirm that the dialog closes exactly once.

Afterward, continue to [[samples/workspace/healthy-workspace-baseline]] or inspect [[samples/projections/reader-theme-adaptation]].
