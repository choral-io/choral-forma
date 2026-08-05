---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Communication Indexes
display:
    order: 30
description: Workspace-local indexes for external synthetic records; they do not contain communication bodies or access rights.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "communications/**/*.md"
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
            value: communication-index
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
        sourceId:
            type: string
            required: true
        sourceKind:
            type: string
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "communications"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/communication-index.md"
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

# Communication Indexes

This partition records where an external record is represented and what it established. It does not reproduce the original message, meeting, ticket, or repository.

<!-- forma:content -->
