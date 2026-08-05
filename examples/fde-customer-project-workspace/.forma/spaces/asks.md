---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Customer Asks
display:
    order: 40
description: Confirmed customer outcomes that still require investigation or delivery work.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "asks/**/*.md"
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
            value: ask
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
    directory: "asks"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/ask.md"
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

# Customer Asks

An ask states the requested outcome. It is not an issue diagnosis, proposal, or approval.

<!-- forma:content -->
