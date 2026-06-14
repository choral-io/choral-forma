---
schemaVersion: 1
kind: view
mode: kanban
title: Todos
display:
  order: 50
description: Example onboarding tasks.
source:
  type: pages
  taxonomy:
    spaces:
      - todos
kanban:
  card:
    titleField: fields.title
    subtitleFields:
      - fields.summary
      - fields.assignees
    badgeFields:
      - fields.priority
      - fields.dueDate
  columns:
    - id: todo
      label: To Do
      query:
        all:
          - field: fields.status
            op: equals
            value: todo
      sort:
        - field: fields.priority
          order:
            - high
            - medium
            - low
        - field: fields.updatedAt
          direction: desc
        - field: fields.createdAt
          direction: desc
    - id: doing
      label: Doing
      query:
        all:
          - field: fields.status
            op: equals
            value: doing
      sort:
        - field: fields.updatedAt
          direction: desc
        - field: fields.createdAt
          direction: desc
    - id: done
      label: Done
      query:
        all:
          - field: fields.status
            op: equals
            value: done
      sort:
        - field: fields.updatedAt
          direction: desc
        - field: fields.createdAt
          direction: desc
---

# Todos

Track onboarding tasks by workflow state.

<!-- forma:content -->
