---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Guidelines
display:
  order: 100
description: Operating guidance for maintaining the product R&D workspace.
schema:
  type: object
  fields:
    title:
      type: string
    summary:
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
  - "guidelines/**/*.md"
create:
  directory: "guidelines"
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

# Guidelines

Operating guidance for maintaining the product R&D workspace.

<!-- forma:content -->
