---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Guidelines
display:
  order: 60
description: Operating guidance for running and extending the workspace.
schema:
  type: object
  fields:
    kind:
      type: string
    title:
      type: string
    summary:
      type: string
    owners:
      type: list
      items:
        type: ref
        target: member
    reviewers:
      type: list
      items:
        type: ref
        target: member
    related_to:
      type: list
      items:
        type: ref
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "guidelines/**/*.md"
create:
  directory: "guidelines"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/guideline.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    owners:
      type: list
      default: []
    reviewers:
      type: list
      default: []
    related_to:
      type: list
      default: []
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

# Guidelines

Operating guidance for running and extending the workspace.

<!-- forma:content -->
