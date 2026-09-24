---
schemaVersion: 1
kind: validation-sample
title: Confirm the Publication Window
summary: Open-ended civil date and point datetime event with an explicit non-UTC offset.
stage: active
priority: P2
area: projections
owner: "Ari Tan"
reviewer: "Mateo Silva"
longValue: "calendar://date-without-end | gantt://datetime-point"
tags:
    - calendar
    - gantt
    - point
relatedSamples: []
opensOn: "2026-10-12"
startsAt: "2026-10-12T09:30:00+08:00"
isMilestone: false
percentComplete: 0
predecessors:
    - "samples/projections/temporal-review"
---

# Confirm the Publication Window

Without an end field, the civil date occupies one day and the datetime is a point event. An authored zero remains distinct from missing progress.
