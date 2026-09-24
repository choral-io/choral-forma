---
schemaVersion: 1
kind: validation-sample
title: Review Calendar and Gantt Semantics
summary: One-day civil date and timezone-qualified milestone dependent on the design task.
stage: review
priority: P1
area: projections
owner: "Mateo Silva"
reviewer: "Priya Nandakumar"
longValue: "calendar://single-day | gantt://milestone-finish-to-start"
tags:
    - calendar
    - gantt
    - milestone
relatedSamples:
    - "samples/projections/temporal-design"
opensOn: "2026-10-08"
startsAt: "2026-10-08T10:00:00+08:00"
endsAt: "2026-10-08T12:00:00+08:00"
isMilestone: true
percentComplete: 100
predecessors:
    - "samples/projections/temporal-design"
---

# Review Calendar and Gantt Semantics

The Calendar event has no authored end date, so it occupies one civil day. The Gantt interval is a milestone and declares the design task as its finish-to-start predecessor.
