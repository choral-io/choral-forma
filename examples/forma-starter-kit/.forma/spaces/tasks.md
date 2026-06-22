---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
display:
  order: 20
description: Delivery tasks tracked as ordinary Markdown pages.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    readiness:
      type: string
    priority:
      type: string
    owners:
      type: list
      items:
        type: ref
        target: member
    assignees:
      type: list
      items:
        type: ref
        target: member
    reviewers:
      type: list
      items:
        type: ref
        target: member
    blockedBy:
      type: list
      items:
        type: ref
        target: task
    dueDate:
      type: string
guidelines:
  - "guidelines/workspace-operations.md"
include:
  - "tasks/**/*.md"
create:
  directory: "tasks"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/task.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    status:
      type: select
      default: todo
      options:
        - value: todo
          label: To Do
        - value: ready
          label: Ready
        - value: doing
          label: Doing
        - value: blocked
          label: Blocked
        - value: reviewing
          label: Reviewing
        - value: done
          label: Done
    readiness:
      type: select
      default: needs-refinement
      options:
        - value: needs-refinement
          label: Needs Refinement
        - value: ready
          label: Ready
        - value: blocked
          label: Blocked
        - value: done
          label: Done
    priority:
      type: select
      default: medium
      options:
        - value: high
          label: High
        - value: medium
          label: Medium
        - value: low
          label: Low
    owners:
      type: list
      default: []
    assignees:
      type: list
      default: []
    reviewers:
      type: list
      default: []
    blockedBy:
      type: list
      default: []
    dueDate:
      type: date
      default: ""
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Tasks

Delivery tasks tracked as ordinary Markdown pages.

Use [[guidelines/task-selection|Task Selection]] when choosing the next task, splitting broad work, or deciding whether an idea belongs in a task or a note.

<!-- forma:content -->
