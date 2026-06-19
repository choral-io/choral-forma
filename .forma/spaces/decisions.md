---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Decisions
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
        target: task
display:
  order: 30
description: Architectural, product, and process decisions as records.
include:
  - "knowledge/decisions/**/*.md"
create:
  directory: knowledge/decisions
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

# Decisions

Decision log and tradeoff records.
