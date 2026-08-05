---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Portfolio Observations
display:
    order: 140
description: Minimal attention metadata for source projects; not an intrinsic Forma portfolio or a second source of truth.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "portfolio-observation/**/*.md"
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
            value: portfolio-observation
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
        stage:
            type: string
            required: true
        blockerClass:
            type: string
            required: true
        lastHealthStatus:
            type: string
            required: true
        ownerRole:
            type: string
            required: true
        projectRefs:
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
    directory: "portfolio-observation"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/portfolio-observation.md"
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

# Portfolio Observations

This is a team-defined metadata record for attention allocation. It does not authorize access, synchronize projects, or provide a built-in portfolio.

<!-- forma:content -->
