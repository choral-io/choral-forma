---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Source Communication Indexes
display:
    order: 40
description: Workspace-local indexes for authorized source records behind a project observation.
guidelines:
    - guidelines/practice-partition-contracts.md
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
        projectRef:
            type: entryRef
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "communications"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/source-index.md"
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

# Source Communication Indexes

Record the authorized source identifier and its project-local purpose. Do not copy original communication bodies or access details.

<!-- forma:content -->
