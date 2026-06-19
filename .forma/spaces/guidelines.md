---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Guidelines
schema:
    type: object
    fields:
        scope:
            type: string
        type:
            type: string
        owners:
            type: list
            items:
                type: ref
                target: member
        tags:
            type: list
            items:
                type: string
        sources:
            type: list
            items:
                type: ref
display:
    order: 60
description: Team and repository guidelines.
include:
    - "knowledge/guidelines/**/*.md"
create:
    directory: knowledge/guidelines
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

# Guidelines

Shared team and project guidance.
