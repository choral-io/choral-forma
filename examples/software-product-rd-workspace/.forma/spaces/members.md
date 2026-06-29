---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Members
display:
  order: 90
description: Team members referenced by product, review, and delivery records.
schema:
  type: object
  fields:
    name:
      type: string
    role:
      type: string
    summary:
      type: string
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "members/**/*.md"
create:
  directory: "members"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/member.md"
  inputs:
    name:
      required: true
    role:
      default: ""
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.name }}"
      transform: slugify
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.name
  summaryField: fields.summary
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Members

Team members referenced by product, review, and delivery records.

<!-- forma:content -->
