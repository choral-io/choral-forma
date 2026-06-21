---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Decisions
display:
  order: 40
description: Short decision records that explain why the workspace is set up this way.
schema:
  type: object
  fields:
    kind:
      type: string
    title:
      type: string
    summary:
      type: string
    status:
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
    decidedAt:
      type: string
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "decisions/**/*.md"
create:
  directory: "decisions"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/decision.md"
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
      default: accepted
      options:
        - value: proposed
          label: Proposed
        - value: accepted
          label: Accepted
        - value: superseded
          label: Superseded
    owners:
      type: list
      default: []
    reviewers:
      type: list
      default: []
    related_to:
      type: list
      default: []
    decidedAt:
      default: "{{ runtime.values.currentDateTime }}"
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

# Decisions

Short decision records that explain why the workspace is set up this way.

<!-- forma:content -->
