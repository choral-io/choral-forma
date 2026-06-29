---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Research
display:
  order: 15
description: User feedback, interviews, market notes, and product insights that inform product direction.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    source:
      type: string
    confidence:
      type: string
    owners:
      type: list
      items:
        type: member
    relatedProduct:
      type: list
      items:
        type: entryRef
    relatedTasks:
      type: list
      items:
        type: task
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "research/**/*.md"
create:
  directory: "research"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/research.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    source:
      default: ""
    confidence:
      default: medium
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

# Research

User feedback, interviews, market notes, and product insights that inform product direction.

<!-- forma:content -->
