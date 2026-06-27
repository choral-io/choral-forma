---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Planning
schema:
    type: object
    fields:
        kind:
            type: string
        title:
            type: string
        summary:
            type: string
        scope:
            type: string
        type:
            type: string
        owners:
            type: list
            items:
                type: member
        tags:
            type: list
            items:
                type: string
        sources:
            type: list
            items:
                type: ref
        reviewers:
            type: list
            items:
                type: member
display:
    order: 70
description: Planning records and roadmaps.
include:
    - "knowledge/planning/**/*.md"
create:
    directory: knowledge/planning
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/content.md
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

# Planning

Roadmaps, release plans, and status views.
