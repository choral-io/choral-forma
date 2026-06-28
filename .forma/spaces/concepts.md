---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Concepts
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
display:
    order: 40
description: Shared concept glossary and abstractions.
include:
    - "knowledge/concepts/**/*.md"
create:
    directory: knowledge/concepts
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

# Concepts

Shared terminology and conceptual framework.
