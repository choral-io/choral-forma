---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Decisions
display:
  order: 30
description: Accepted product, architecture, and workflow decisions.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    owners:
      type: list
      items:
        type: member
    reviewers:
      type: list
      items:
        type: member
    tags:
      type: list
      items:
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

# Decisions

Accepted product, architecture, and workflow decisions.

<!-- forma:content -->
