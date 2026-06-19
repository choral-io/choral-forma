---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Discovery
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
  order: 50
description: Discovery notes and feature exploration results.
include:
  - "knowledge/discovery/**/*.md"
create:
  directory: knowledge/discovery
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

# Discovery

Exploratory findings and competitive analysis.
