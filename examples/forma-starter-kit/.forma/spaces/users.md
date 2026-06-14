---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Users
display:
  order: 30
description: Example people referenced by tasks and pages.
include:
  - "users/**/*.md"
create:
  directory: "users"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/user.md"
  inputs:
    name:
      required: true
    description:
      default: ""
    responsibilities:
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
  summaryField: fields.description
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Users

Example people referenced by tasks and pages.

<!-- forma:content -->
