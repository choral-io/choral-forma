---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Planning
schema:
  type: object
  fields:
    scope:
      type: string
    type:
      type: string
    owners:
      type: list
      items:
        type: ref
        target: member
    tags:
      type: list
      items:
        type: string
    sources:
      type: list
      items:
        type: ref
display:
  order: 70
description: Planning records and roadmaps.
include:
  - "knowledge/planning/**/*.md"
create:
  directory: knowledge/planning
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/knowledge.md
  inputs:
    title:
      required: true
    slug:
      default: "{{ input.title }}"
      transform: slugify
    summary:
      default: ""
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Planning

Roadmaps, release plans, and status views.
