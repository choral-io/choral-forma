---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Metrics
display:
  order: 50
description: Product, quality, and delivery readiness metrics.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    unit:
      type: string
    direction:
      type: string
    target:
      type: string
    owners:
      type: list
      items:
        type: member
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "metrics/**/*.md"
create:
  directory: "metrics"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/metric.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    unit:
      default: ""
    target:
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

# Metrics

Product, quality, and delivery readiness metrics.

<!-- forma:content -->
