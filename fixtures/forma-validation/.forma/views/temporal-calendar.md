---
schemaVersion: 1
kind: view
title: Temporal Validation Calendar
description: Civil-date Calendar fixture with classification, inclusive ranges, point dates, and unscheduled entries.
mode: calendar
display:
    order: 50
source:
    type: pages
    taxonomy:
        spaces:
            - samples
    include:
        - "samples/projections/temporal-*.md"
calendar:
    start:
        field: fields.opensOn
    end:
        field: fields.closesOn
    firstDayOfWeek: monday
    presentation:
        events:
            colorBy:
                field: fields.area
---

# Temporal Validation Calendar

<!-- forma:content -->

Calendar entries are classified by the configured sample `area` field.
