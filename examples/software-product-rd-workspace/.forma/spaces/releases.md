---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Releases
display:
  order: 80
description: Release scope, validation evidence, rollout notes, and follow-up decisions.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    version:
      type: string
    date:
      type: string
    owners:
      type: list
      items:
        type: member
    relatedTasks:
      type: list
      items:
        type: task
    relatedValidation:
      type: list
      items:
        type: validation
    relatedMetrics:
      type: list
      items:
        type: metric
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "releases/**/*.md"
create:
  directory: "releases"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/release.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    version:
      default: ""
    date:
      type: date
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

# Releases

Release scope, validation evidence, rollout notes, and follow-up decisions.

<!-- forma:content -->
