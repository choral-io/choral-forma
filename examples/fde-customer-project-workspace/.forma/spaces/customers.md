---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Customer Facts
display:
    order: 20
description: Stable synthetic facts about the customer project; never a copy of external communication or credentials.
guidelines:
    - guidelines/partition-contracts.md
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
            value: customer-fact
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
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "customers"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/customer-fact.md"
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

# Customer Facts

Customer facts are synthetic project context. Keep external records as indexes in `communications/` and keep secrets out of this partition.

<!-- forma:content -->
