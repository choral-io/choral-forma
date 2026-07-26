---
schemaVersion: 1
kind: term
id: samples
taxonomy: spaces
title: Validation Samples
schema:
    type: object
    fields:
        kind:
            type: string
        title:
            type: string
        summary:
            type: string
        stage:
            type: sampleStage
        priority:
            type: priority
        area:
            type: sampleArea
        owner:
            type: string
        reviewer:
            type: string
        longValue:
            type: string
        tags:
            type: list
            items:
                type: string
        relatedSamples:
            type: list
            items:
                type: sample
display:
    order: 20
description: Deterministic records reused across Reader, Table, Kanban, Graph, Browse, and Quick Open validation.
include:
    - "samples/**/*.md"
create:
    directory: samples
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/sample.md
    inputs:
        title:
            required: true
        slug:
            default: "{{ input.title }}"
            transform: slugify
        summary:
            default: ""
conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Validation Samples

Reusable deterministic records shared by multiple validation cases.
