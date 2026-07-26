---
schemaVersion: 1
kind: validation-sample
title: Variable Height Kanban Header Measurement
summary: Multiline card content and long labels used to prove that sticky Kanban geometry follows live measurements.
stage: review
priority: P0
area: projections
owner: "Priya Nandakumar"
reviewer: "Mateo Silva"
longValue: "kanban://measure-the-tallest-visible-column-header-after-wrap-resize-and-runtime-layout-change"
tags:
    - kanban
    - sticky
    - resize-observer
relatedSamples:
    - "samples/projections/graph-reference-density"
    - "samples/navigation/quick-open-long-label"
---

# Variable Height Kanban Header Measurement

The corresponding view uses deliberately verbose column labels. Header geometry must be measured after wrapping rather than assumed from a fixed pixel value.

Compare its behavior with [[samples/projections/graph-reference-density]] and [[samples/navigation/quick-open-long-label]].
