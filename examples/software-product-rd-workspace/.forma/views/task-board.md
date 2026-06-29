---
schemaVersion: 1
kind: view
mode: kanban
title: Task Board
display:
  order: 10
description: Delivery tasks grouped by workflow status.
source:
  type: pages
  taxonomy:
    spaces:
      - tasks
kanban:
  card:
    titleField: fields.title
    subtitleFields:
      - fields.summary
      - fields.readiness
    badgeFields:
      - fields.priority
  columns:
    - id: backlog
      label: Backlog
      query:
        all:
          - field: fields.status
            op: equals
            value: backlog
    - id: ready
      label: Ready
      query:
        all:
          - field: fields.status
            op: equals
            value: ready
    - id: doing
      label: Doing
      query:
        all:
          - field: fields.status
            op: equals
            value: doing
    - id: blocked
      label: Blocked
      query:
        all:
          - field: fields.status
            op: equals
            value: blocked
    - id: reviewing
      label: Reviewing
      query:
        all:
          - field: fields.status
            op: equals
            value: reviewing
    - id: done
      label: Done
      query:
        all:
          - field: fields.status
            op: equals
            value: done
---

# Task Board

Delivery tasks grouped by workflow status.

<!-- forma:content -->
