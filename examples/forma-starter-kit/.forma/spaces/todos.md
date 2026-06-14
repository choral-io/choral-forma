---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Todos
display:
  order: 20
description: Example onboarding and workspace setup tasks.
include:
  - "todos/**/*.md"
create:
  directory: "todos"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/todo.md"
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
        - value: doing
          label: Doing
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
    assignees:
      type: list
      default: []
    dueDate:
      type: date
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

# Todos

Example onboarding and workspace setup tasks.

<!-- forma:content -->
