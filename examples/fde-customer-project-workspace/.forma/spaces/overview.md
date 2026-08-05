---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Engagement Overview
display:
    order: 10
description: The single narrative map for the synthetic engagement and its local evidence trail.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "overview/**/*.md"
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
            value: overview
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
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "overview"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/overview.md"
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

# Engagement Overview

The overview is the narrative map. It points to evidence; it is not a replacement for customer facts, decisions, or verification records.

<!-- forma:content -->
