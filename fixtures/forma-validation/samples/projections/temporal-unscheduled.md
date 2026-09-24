---
schemaVersion: 1
kind: validation-sample
title: Triage an Unscheduled Follow-up
summary: Unscheduled in both views while retaining progress and a resolved predecessor.
stage: queued
priority: P2
area: projections
owner: "Ari Tan"
reviewer: "Priya Nandakumar"
longValue: "calendar://unscheduled-list | gantt://unscheduled-node-retains-progress-and-dependency"
tags:
    - calendar
    - gantt
    - unscheduled
relatedSamples: []
predecessors:
    - "samples/projections/temporal-review"
---

# Triage an Unscheduled Follow-up

No date, datetime, or progress value is authored. The entry remains available in Calendar's Unscheduled group and Gantt's complete node list with its predecessor; the separate temporal-point sample carries an authored zero progress value.
