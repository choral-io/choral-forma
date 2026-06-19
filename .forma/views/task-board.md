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
                  - field: status
                    op: equals
                    value: backlog
        - id: ready
          label: Ready
          query:
              all:
                  - field: status
                    op: equals
                    value: ready
        - id: doing
          label: Doing
          query:
              all:
                  - field: status
                    op: equals
                    value: doing
        - id: reviewing
          label: Reviewing
          query:
              all:
                  - field: status
                    op: equals
                    value: reviewing
        - id: blocked
          label: Blocked
          query:
              all:
                  - field: status
                    op: equals
                    value: blocked
        - id: done
          label: Done
          query:
              all:
                  - field: status
                    op: equals
                    value: done
        - id: cancelled
          label: Cancelled
          query:
              all:
                  - field: status
                    op: equals
                    value: cancelled
    card:
        titleField: title
        subtitleFields:
            - summary
            - assignees
        badgeFields:
            - priority
            - readiness
---

# Task Board

Delivery task board generated from task metadata.
