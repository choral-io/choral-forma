---
schemaVersion: 1
kind: view
mode: kanban
title: Tasks
display:
  order: 50
description: Example work tracked with status, readiness, and review fields.
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
      - fields.owners
      - fields.assignees
    badgeFields:
      - fields.priority
      - fields.readiness
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
    - id: ready
      label: Ready
      query:
        all:
          - field: fields.status
            op: equals
            value: ready
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
    - id: blocked
      label: Blocked
      query:
        all:
          - field: fields.status
            op: equals
            value: blocked
      sort:
        - field: fields.updatedAt
          direction: desc
        - field: fields.createdAt
          direction: desc
    - id: reviewing
      label: Reviewing
      query:
        all:
          - field: fields.status
            op: equals
            value: reviewing
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

# Tasks

Track example work by workflow state.

<!-- forma:content -->
