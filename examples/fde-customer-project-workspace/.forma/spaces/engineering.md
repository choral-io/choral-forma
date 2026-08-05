---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Engineering Context
display:
  order: 20
description: Markdown context cards for ordinary code, configuration, fixtures, and regression tests.
include:
  - "engineering/**/*.md"
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    type:
      type: string
    status:
      type: string
    artifactKind:
      type: string
    engagementKey:
      type: string
    fixturePaths:
      type: list
      items:
        type: string
    commands:
      type: list
      items:
        type: string
    expected:
      type: list
      items:
        type: string
    failureConditions:
      type: list
      items:
        type: string
    relatedTo:
      type: list
      items:
        type: entryRef
    sources:
      type: list
      items:
        type: entryRef
create:
  directory: "engineering"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/entry.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    type:
      default: engineering-context
    status:
      default: draft
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Engineering Context

The Markdown cards explain ordinary engineering files. The fixture itself remains an ordinary unmanaged Node project.

<!-- forma:content -->
