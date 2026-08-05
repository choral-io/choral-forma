---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Decisions
display:
    order: 70
description: Human-confirmed choices, boundaries, and reasons for the synthetic engagement.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "decisions/**/*.md"
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
            value: decision
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
    directory: "decisions"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/decision.md"
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

# Decisions

A decision records a human-confirmed choice. It must point back to the evidence and proposal that informed it.

<!-- forma:content -->
