---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Proposals
display:
    order: 60
description: Candidate solutions and trade-offs that are not decisions until a human confirms them.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "proposals/**/*.md"
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
            value: proposal
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
    directory: "proposals"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/proposal.md"
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

# Proposals

A proposal is a candidate solution. Keep approval and final scope in `decisions/`.

<!-- forma:content -->
