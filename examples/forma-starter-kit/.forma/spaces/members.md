---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Members
display:
  order: 30
description: Team members referenced by tasks and shared notes.
schema:
  type: object
  fields:
    name:
      type: string
    description:
      type: string
    responsibilities:
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

# Members

Team members referenced by tasks and shared notes.

<!-- forma:content -->
