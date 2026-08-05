---
schemaVersion: 1
kind: term
taxonomy: spaces
title: De-identified Customer Indexes
display:
    order: 20
description: Minimal customer metadata needed to interpret a project observation without copying customer facts.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "customers/**/*.md"
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
            value: customer-source-index
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
        customerKey:
            type: string
            required: true
        environment:
            type: string
            required: true
        allowedShare:
            type: string
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "customers"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/customer-index.md"
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

# De-identified Customer Indexes

Keep only the minimum environment and sharing boundary needed for practice review. Do not copy customer facts.

<!-- forma:content -->
