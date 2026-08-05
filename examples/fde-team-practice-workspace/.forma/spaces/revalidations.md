---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Revalidations
display:
    order: 120
description: Project-local records explaining whether a reviewed practice still applies or must be adjusted.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "revalidations/**/*.md"
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
            value: revalidation
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
        projectKey:
            type: string
            required: true
        environment:
            type: string
            required: true
        projectRef:
            type: entryRef
            required: true
        sources:
            type: list
            items:
                type: entryRef
            required: true
        result:
            type: string
            required: true
        reason:
            type: string
            required: true
        revalidationReason:
            type: string
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "revalidations"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/revalidation.md"
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

# Revalidations

A revalidation is required before reuse. Preserve the current environment, outcome, reason, and any adjustment.

<!-- forma:content -->
