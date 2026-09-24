---
schemaVersion: 1
kind: validation-sample
title: Draft the Temporal View Contract
summary: Multi-day civil-date event paired with a timezone-qualified implementation interval.
stage: active
priority: P1
area: projections
owner: "Priya Nandakumar"
reviewer: "Mateo Silva"
longValue: "calendar://civil-date-inclusive-end | gantt://datetime-offset-normalized"
tags:
    - calendar
    - gantt
    - multi-day
relatedSamples: []
opensOn: "2026-10-05"
closesOn: "2026-10-07"
startsAt: "2026-10-05T09:00:00+08:00"
endsAt: "2026-10-07T17:00:00+08:00"
isMilestone: false
percentComplete: 40
predecessors: []
---

# Draft the Temporal View Contract

The civil-date range includes both authored dates. The datetime interval has an explicit Kuala Lumpur offset and ends at the authored exclusive instant.

The next step is [[samples/projections/temporal-review]].
