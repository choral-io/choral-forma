---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Practice Proposals
display:
    order: 70
description: Candidate practice abstractions awaiting human review.
guidelines:
    - guidelines/practice-partition-contracts.md
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
    template: ".forma/spaces/templates/practice-proposal.md"
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

# Practice Proposals

Proposals make a limited claim for review. They do not automatically become patterns, guidelines, templates, or code.

<!-- forma:content -->
