---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Human Reviews
display:
    order: 80
description: Human decisions accepting, rejecting, or adjusting a proposed practice abstraction.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "reviews/**/*.md"
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
            value: human-review
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
        decision:
            type: string
            required: true
        humanReviewRole:
            type: string
            required: true
        reason:
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
    directory: "reviews"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/human-review.md"
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

# Human Reviews

This partition records a human decision about a proposal. Agent analysis can prepare the review but cannot substitute for it.

<!-- forma:content -->
