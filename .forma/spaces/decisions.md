---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Decisions
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
                type: ref
                target: member
        reviewers:
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
        supersedes:
            type: list
            items:
                type: ref
        supersededBy:
            type: list
            items:
                type: ref
display:
    order: 30
description: Architectural, product, and process decisions as records.
include:
    - "knowledge/decisions/**/*.md"
create:
    directory: knowledge/decisions
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

# Decisions

Decision log and tradeoff records.
