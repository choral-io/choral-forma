---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Validation
display:
  order: 60
description: Reusable acceptance and validation cases.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    priority:
      type: priority
    owners:
      type: list
      items:
        type: member
    relatedTasks:
      type: list
      items:
        type: task
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "validation/**/*.md"
create:
  directory: "validation"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/content.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
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

# Validation

Reusable acceptance and validation cases.

<!-- forma:content -->
