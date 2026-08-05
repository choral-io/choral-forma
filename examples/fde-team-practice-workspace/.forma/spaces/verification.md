---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Verification Results
display:
    order: 60
description: Stable result manifests for positive, negative, and adjusted project observations.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "verification/**/*.md"
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
            value: verification-result
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
        projectKey:
            type: string
            required: true
        environment:
            type: string
            required: true
        result:
            type: string
            required: true
        exitStatus:
            type: string
            required: true
        actual:
            type: list
            items:
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
    directory: "verification"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/verification-result.md"
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

# Verification Results

Keep positive, negative, and adjusted results as separate evidence. A result manifest is not a promotion signal.

<!-- forma:content -->
