---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Architecture
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
    order: 20
description: Core architecture and systems design records.
include:
    - "knowledge/architecture/**/*.md"
create:
    directory: knowledge/architecture
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

# Architecture

Architecture records for implementation and system design.
