---
schemaVersion: 1
kind: view
title: Temporal Validation Gantt
description: Datetime Gantt fixture with progress, milestone, finish-to-start dependencies, and unscheduled nodes.
mode: gantt
display:
    order: 60
source:
    type: pages
    taxonomy:
        spaces:
            - samples
    include:
        - "samples/projections/temporal-*.md"
gantt:
    start:
        field: fields.startsAt
    end:
        field: fields.endsAt
    milestone:
        field: fields.isMilestone
    progress:
        field: fields.percentComplete
    dependencies:
        field: fields.predecessors
        relation: finishToStart
    presentation:
        rows:
            colorBy:
                field: fields.area
---

# Temporal Validation Gantt

<!-- forma:content -->

All timestamps include an explicit non-UTC offset. The workspace timezone is used when projecting their instants to days.
