---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
display:
  order: 70
description: Delivery tasks tracked as Markdown with status, readiness, ownership, and dependencies.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    status:
      type: taskStatus
    readiness:
      type: readiness
    priority:
      type: priority
    owners:
      type: list
      items:
        type: member
    assignees:
      type: list
      items:
        type: member
    reviewers:
      type: list
      items:
        type: member
    blockedBy:
      type: list
      items:
        type: task
    relatedTo:
      type: list
      items:
        type: entryRef
    createdAt:
      type: string
    updatedAt:
      type: string
guidelines:
  - "guidelines/product-rd-flow.md"
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
      default: backlog
      options:
        - value: backlog
          label: Backlog
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
    priority:
      type: select
      default: P2
      options:
        - value: P0
          label: P0
        - value: P1
          label: P1
        - value: P2
          label: P2
        - value: P3
          label: P3
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

Delivery tasks tracked as Markdown with status, readiness, ownership, and dependencies.

<!-- forma:content -->
