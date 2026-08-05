---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Project Observations
display:
    order: 30
description: De-identified project-level evidence indexes with an explicit environment and allowed-share boundary.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "projects/**/*.md"
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
            value: project-source-index
            required: true
        status:
            type: string
            required: true
        synthetic:
            type: const
            value: "true"
            required: true
        sourceEngagementKey:
            type: string
            required: true
        customerKey:
            type: string
            required: true
        projectKey:
            type: string
            required: true
        environment:
            type: string
            required: true
        customerRef:
            type: entryRef
            required: true
        sources:
            type: list
            items:
                type: entryRef
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
    directory: "projects"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/project-observation.md"
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

# Project Observations

This partition indexes a de-identified project observation. It is the source boundary for evidence cards, not a cross-workspace import.

<!-- forma:content -->
