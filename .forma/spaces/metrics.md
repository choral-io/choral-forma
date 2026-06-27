---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Metrics
schema:
    type: object
    fields:
        kind:
            type: string
        title:
            type: string
        summary:
            type: string
        scope:
            type: string
        type:
            type: string
        status:
            type: string
        owners:
            type: list
            items:
                type: member
        tags:
            type: list
            items:
                type: string
        source:
            type: string
        unit:
            type: string
        direction:
            type: string
        target:
            type: string
        reviewCadence:
            type: string
        relatedExperiments:
            type: list
            items:
                type: experiment
        relatedReleases:
            type: list
            items:
                type: release
display:
    order: 55
description: Product, quality, and delivery metric definitions.
include:
    - "knowledge/metrics/**/*.md"
create:
    directory: knowledge/metrics
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/metric.md
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

# Metrics

Metric definitions used to evaluate product, quality, and delivery decisions.
