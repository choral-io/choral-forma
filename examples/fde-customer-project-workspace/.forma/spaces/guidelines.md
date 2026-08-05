---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Operating Guidelines
display:
    order: 100
description: Agent-facing operating rules and approval boundaries for this workspace.
guidelines:
    - guidelines/partition-contracts.md
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
            value: guideline
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
create:
    directory: "guidelines"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/guideline.md"
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

# Operating Guidelines

Guidelines are Agent-facing instructions and boundaries. They are not customer facts, decisions, or external permissions.

<!-- forma:content -->
