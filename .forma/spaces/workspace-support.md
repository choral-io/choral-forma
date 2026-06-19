---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Workspace Support
schema:
  type: object
  fields:
    kind:
      type: string
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
  order: 100
description: Shared workspace handoffs and research support notes.
include:
  - "knowledge/workspace/*/handoffs/**/*.md"
  - "knowledge/workspace/*/research/**/*.md"
create:
  directory: knowledge/workspace/Tiscs/research
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

# Workspace Support

Knowledge-workflow handoffs and support research notes.
