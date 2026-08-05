---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Patterns
display:
    order: 90
description: Reviewed conditional patterns that state applicability, limits, and known counterexamples.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "patterns/**/*.md"
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
            value: pattern
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
        applicability:
            type: string
            required: true
        limits:
            type: string
            required: true
        counterexample:
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
    directory: "patterns"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/pattern.md"
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

# Patterns

A pattern is conditional guidance after review. Preserve its limits and counterexample; do not turn it into a universal threshold.

<!-- forma:content -->
