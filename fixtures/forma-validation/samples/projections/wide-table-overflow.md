---
schemaVersion: 1
kind: validation-sample
title: Wide Table Overflow Ownership
summary: Projection record with long owner, reviewer, path, and diagnostic fields for forcing a locally scrollable table.
stage: active
priority: P0
area: projections
owner: "Jordan Rivera — Projection Geometry"
reviewer: "Samira Okafor — Responsive Verification"
longValue: "workspace://fixtures/forma-validation/samples/projections/wide-table-overflow?expectedOwner=projection-table-horizontal-rail&rootOverflow=false"
tags:
    - table
    - sticky
    - overflow
    - long-value
relatedSamples:
    - "samples/projections/variable-kanban-header"
---

# Wide Table Overflow Ownership

This record deliberately provides long scalar and list values to make the configured Table wider than a narrow viewport.

Its nearest projection relation is [[samples/projections/variable-kanban-header]].
