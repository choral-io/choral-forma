---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
display:
  order: 10
description: Delivery tasks tracked as repository Markdown.
include:
  - "knowledge/tasks/**/*.md"
create:
  directory: knowledge/tasks
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/task.md
  inputs:
    title:
      required: true
    slug:
      default: "{{ input.title }}"
      transform: slugify
    scope:
      default: project
    summary:
      default: ""
    type:
      default: task
    priority:
      default: P2
    value:
      default: M
    module:
      default: knowledge
    effort:
      default: M
    readiness:
      default: needs-refinement
    owners:
      default: []
    assignees:
      default: []
    reviewers:
      default: []
    tags:
      default: []
    blocked_by:
      default: []
    related_to:
      default: []
    severity:
      default: ""
    sprint:
      default: ""
    reported_by:
      default: ""
    affected_area:
      default: ""
conventions:
  titleField: title
  summaryField: summary
---

# Tasks

Delivery tasks tracked as repository Markdown.
