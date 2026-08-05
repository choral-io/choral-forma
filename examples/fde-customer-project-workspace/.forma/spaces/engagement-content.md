---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Engagement Content
display:
  order: 10
description: Team-defined Markdown records for customer facts, communications, asks, issues, decisions, tasks, runbooks, guidelines, and verification.
include:
  - "overview/**/*.md"
  - "customers/**/*.md"
  - "communications/**/*.md"
  - "asks/**/*.md"
  - "issues/**/*.md"
  - "proposals/**/*.md"
  - "decisions/**/*.md"
  - "tasks/**/*.md"
  - "runbooks/**/*.md"
  - "guidelines/**/*.md"
  - "verifications/**/*.md"
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
    kind:
      type: string
    synthetic:
      type: string
    engagementKey:
      type: string
    customerKey:
      type: string
    projectKey:
      type: string
    environment:
      type: string
    sourceId:
      type: string
    sourceKind:
      type: string
    artifactKind:
      type: string
    result:
      type: string
    exitStatus:
      type: string
    decision:
      type: string
    reason:
      type: string
    ownerRole:
      type: string
    tags:
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
    commands:
      type: list
      items:
        type: string
    expected:
      type: list
      items:
        type: string
    actual:
      type: list
      items:
        type: string
    failureConditions:
      type: list
      items:
        type: string
    fixturePaths:
      type: list
      items:
        type: string
create:
  directory: "asks"
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
      default: entry
    status:
      default: draft
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Engagement Content

These folders are an explicit team-defined grouping, not built-in Forma domains.

<!-- forma:content -->
