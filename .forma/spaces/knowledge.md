---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Knowledge
display:
    order: 20
description: Shared project knowledge excluding task records and local member state.
include:
    - "knowledge/architecture/**/*.md"
    - "knowledge/concepts/**/*.md"
    - "knowledge/decisions/**/*.md"
    - "knowledge/design/**/*.md"
    - "knowledge/discovery/**/*.md"
    - "knowledge/planning/**/*.md"
    - "knowledge/product/**/*.md"
    - "knowledge/proposals/**/*.md"
    - "knowledge/research/**/*.md"
    - "knowledge/guidelines/**/*.md"
create:
    directory: knowledge
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/knowledge.md
    inputs:
        title:
            required: true
        slug:
            default: "{{ input.title }}"
            transform: slugify
        summary:
            default: ""
conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Knowledge

Shared product, architecture, planning, and decision records.
