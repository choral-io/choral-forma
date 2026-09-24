---
schemaVersion: 1
kind: view
mode: gantt
title: Exhibition Timeline
source:
    type: pages
    taxonomy:
        collections: [all-day, timed]
query:
    all:
        - field: fields.visible
          op: equals
          value: true
gantt:
    start: { field: fields.opensOn }
    end: { field: fields.closesOn }
    milestone: { field: fields.isMilestone }
    progress: { field: fields.percentComplete }
    dependencies: { field: fields.predecessors }
    presentation:
        rows:
            colorBy: { field: fields.category }
---

# Exhibition Timeline

<!-- forma:content -->
