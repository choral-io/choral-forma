---
schemaVersion: 1
kind: view
mode: calendar
title: Exhibition Calendar
source:
    type: pages
    taxonomy:
        collections: [all-day, timed]
query:
    all:
        - field: fields.visible
          op: equals
          value: true
calendar:
    start: { field: fields.opensOn }
    end: { field: fields.closesOn }
    firstDayOfWeek: sunday
    presentation:
        events:
            colorBy: { field: fields.category }
---

# Exhibition Calendar

<!-- forma:content -->
