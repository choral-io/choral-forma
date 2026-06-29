---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Experiments
display:
  order: 55
description: Small product or workflow experiments with explicit hypotheses and results.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    hypothesis:
      type: string
    owners:
      type: list
      items:
        type: member
    relatedMetrics:
      type: list
      items:
        type: metric
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "experiments/**/*.md"
create:
  directory: "experiments"
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

# Experiments

Small product or workflow experiments with explicit hypotheses and results.

<!-- forma:content -->
