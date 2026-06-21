---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Proposals
display:
  order: 50
description: Reviewable changes that may later become notes, tasks, or decisions.
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
    related_to:
      type: list
      items:
        type: ref
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "proposals/**/*.md"
create:
  directory: "proposals"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/proposal.md"
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
      default: proposed
      options:
        - value: proposed
          label: Proposed
        - value: reviewing
          label: Reviewing
        - value: accepted
          label: Accepted
    owners:
      type: list
      default: []
    assignees:
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

# Proposals

Reviewable changes that may later become notes, tasks, or decisions.

<!-- forma:content -->
