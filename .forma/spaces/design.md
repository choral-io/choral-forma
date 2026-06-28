---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Design
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
                type: entryRef
        reviewers:
            type: list
            items:
                type: member
display:
    order: 25
description: Design artifacts, UX patterns, and implementation UI specs.
include:
    - "knowledge/design/**/*.md"
create:
    directory: knowledge/design
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

# Design

Product and UX design records.
