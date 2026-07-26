---
schemaVersion: 1
kind: view
title: Variable Height Kanban
description: Five-column board with verbose labels and varied cards for measured sticky-header geometry.
mode: kanban
display:
    order: 30
source:
    type: pages
    taxonomy:
        spaces:
            - samples
kanban:
    columns:
        - id: queued
          label: Queued — awaiting structured review
          query:
              all:
                  - field: fields.stage
                    op: equals
                    value: queued
        - id: active
          label: Active — implementation and verification in progress
          query:
              all:
                  - field: fields.stage
                    op: equals
                    value: active
        - id: review
          label: Review — evidence and acceptance checks
          query:
              all:
                  - field: fields.stage
                    op: equals
                    value: review
        - id: blocked
          label: Blocked — dependency or diagnostic follow-up
          query:
              all:
                  - field: fields.stage
                    op: equals
                    value: blocked
        - id: done
          label: Done — verified against the current contract
          query:
              all:
                  - field: fields.stage
                    op: equals
                    value: done
    card:
        titleField: fields.title
        subtitleFields:
            - fields.summary
            - fields.owner
        badgeFields:
            - fields.priority
            - fields.area
---

# Variable Height Kanban

Verbose labels intentionally wrap at different heights when the viewport changes.

<!-- forma:content -->

The board's sticky row must stop before this document content resumes.
