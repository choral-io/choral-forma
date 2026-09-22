---
schemaVersion: 1
kind: view
title: Task Timeline
description: Read-only due-date timeline with explicitly configured predecessor references.
mode: gantt
source:
  type: pages
  taxonomy:
    spaces:
      - tasks
gantt:
  start:
    field: fields.dueDate
  dependencies:
    field: fields.blockedBy
    relation: finishToStart
---

# Task Timeline

Each configured due date is a one-day interval, not an inferred task duration. Predecessors describe declared relationships only; Forma does not compute scheduling conflicts or change dates. WebApp provides the interactive timeline and complete list. Static pages and editor previews provide the complete interval and predecessor list.
