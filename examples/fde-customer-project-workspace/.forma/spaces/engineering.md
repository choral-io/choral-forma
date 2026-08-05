---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Engineering Context
display:
    order: 120
description: Markdown context cards for ordinary code, configuration, fixtures, and regression tests; the ordinary fixture assets remain unmanaged.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "engineering/**/*.md"
schema:
    type: object
    fields:
        title:
            type: string
            required: true
        summary:
            type: string
            required: true
        type:
            type: string
            required: true
        status:
            type: string
            required: true
        synthetic:
            type: const
            value: "true"
            required: true
        engagementKey:
            type: string
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
        artifactKind:
            type: string
        fixturePaths:
            type: list
            items:
                type: string
        commands:
            type: list
            items:
                type: string
        expected:
            type: list
            items:
                type: string
        failureConditions:
            type: list
            items:
                type: string
create:
    directory: "engineering"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/engineering.md"
    inputs:
        title:
            required: true
        summary:
            default: ""
        slug:
            type: string
            default: "{{ input.title }}"
            transform: slugify
        status:
            default: draft
conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Engineering Context

This content group contains Markdown context cards only. The Node source, JSON configuration, fixture inputs, and tests under `engineering/fixture/` are ordinary unmanaged engineering assets and must be run directly.

<!-- forma:content -->
