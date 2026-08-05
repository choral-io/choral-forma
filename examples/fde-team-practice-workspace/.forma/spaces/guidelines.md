---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Practice Guidelines
display:
    order: 100
description: Agent-facing instructions for using reviewed practice conditionally and revalidating before reuse.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "guidelines/**/*.md"
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
            type: const
            value: practice-guideline
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
        sources:
            type: list
            items:
                type: entryRef
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "guidelines"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/practice-guideline.md"
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

# Practice Guidelines

Guidelines tell an Agent how to reuse reviewed practice conditionally. They are not automatic promotion rules.

<!-- forma:content -->
