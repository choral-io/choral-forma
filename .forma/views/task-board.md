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
        - id: needs-refinement
          label: Needs Refinement
          query:
              all:
                  - field: readiness
                    op: equals
                    value: needs-refinement
        - id: ready
          label: Ready
          query:
              all:
                  - field: readiness
                    op: equals
                    value: ready
        - id: blocked
          label: Blocked
          query:
              all:
                  - field: readiness
                    op: equals
                    value: blocked
---

# Task Board

Delivery task board generated from task metadata.
