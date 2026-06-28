---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Product
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
    order: 10
description: Product-level direction and product scope records.
include:
    - "knowledge/product/**/*.md"
create:
    directory: knowledge/product
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

# Product

Product records and direction artifacts.
