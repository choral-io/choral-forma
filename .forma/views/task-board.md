---
schemaVersion: 1
kind: view
title: Task Board
mode: kanban
source:
    type: pages
    taxonomy:
        spaces:
            - tasks
kanban:
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
        - id: reviewing
          label: Reviewing
          query:
              all:
                  - field: fields.status
                    op: equals
                    value: reviewing
        - id: blocked
          label: Blocked
          query:
              all:
                  - field: fields.status
                    op: equals
                    value: blocked
        - id: done
          label: Done
          query:
              all:
                  - field: fields.status
                    op: equals
                    value: done
        - id: cancelled
          label: Cancelled
          query:
              all:
                  - field: fields.status
                    op: equals
                    value: cancelled
    card:
        titleField: fields.title
        subtitleFields:
            - fields.summary
            - fields.assignees
        badgeFields:
            - fields.priority
            - fields.readiness
---

# Task Board

Delivery task board generated from task metadata.

<!-- forma:content -->
