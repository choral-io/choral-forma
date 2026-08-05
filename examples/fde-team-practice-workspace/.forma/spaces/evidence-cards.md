---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Evidence Cards
display:
    order: 50
description: Human-reviewable comparisons that preserve source projects, differences, failure paths, and revalidation reasons.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "evidence-cards/**/*.md"
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
            value: evidence-card
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
        sourceProjects:
            type: list
            items:
                type: entryRef
            required: true
        results:
            type: list
            items:
                type: entryRef
            required: true
        environmentDifference:
            type: string
            required: true
        counterexample:
            type: string
            required: true
        revalidationReason:
            type: string
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "evidence-cards"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/evidence-card.md"
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

# Evidence Cards

An evidence card compares already-authorized local observations. It must retain at least two source projects, a meaningful difference, a failure or counterexample, and a revalidation reason.

<!-- forma:content -->
