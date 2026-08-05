---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Reusable Templates
display:
    order: 110
description: Reviewed team-authored shapes for de-identified evidence, with explicit applicability and sharing limits.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "reusable-templates/**/*.md"
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
            value: reusable-template
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
    directory: "reusable-templates"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/reusable-template.md"
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

# Reusable Templates

A reusable template is a reviewed team convention. It must state who may use it and what information must remain excluded.

<!-- forma:content -->
