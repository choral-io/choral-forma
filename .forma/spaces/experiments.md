---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Experiments
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
                type: ref
                target: member
        tags:
            type: list
            items:
                type: string
        hypothesis:
            type: string
        guardrails:
            type: list
            items:
                type: string
        metrics:
            type: list
            items:
                type: ref
                target: metric
                guardrails:
                    type: list
                    items:
                        type: string
        relatedUserStories:
            type: list
            items:
                type: ref
                target: user-story
        relatedReleases:
            type: list
            items:
                type: ref
                target: release
display:
    order: 57
description: Product and workflow experiments with metrics, guardrails, and decisions.
include:
    - "knowledge/experiments/**/*.md"
create:
    directory: knowledge/experiments
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/experiment.md
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

# Experiments

Experiment records for product discovery, workflow validation, and decision evidence.
