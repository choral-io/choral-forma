---
kind: view
mode: kanban
title: Notes Board
source:
    type: pages
    taxonomy:
        spaces: [notes]
kanban:
    columns:
        - id: doing
          label: Doing
          query:
              all:
                  - field: fields.status
                    op: equals
                    value: doing
        - id: done
          label: Done
          query:
              all:
                  - field: fields.status
                    op: equals
                    value: done
---

# Notes Board

<!-- forma:content -->
