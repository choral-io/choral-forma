---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Issues
display:
    order: 50
description: Observed mismatches or risks tied to a customer and environment, with local evidence.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "issues/**/*.md"
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
            value: issue
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
    directory: "issues"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/issue.md"
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

# Issues

An issue records an observed mismatch or risk. Record the environment and evidence before proposing a change.

<!-- forma:content -->
