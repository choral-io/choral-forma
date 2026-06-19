---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Releases
schema:
    type: object
    fields:
        scope:
            type: string
        type:
            type: string
        status:
            type: string
        version:
            type: string
        date:
            type: date
        owners:
            type: list
            items:
                type: ref
                target: member
        tags:
            type: list
            items:
                type: string
        related_tasks:
            type: list
            items:
                type: ref
                target: task
    related_test_cases:
        type: list
        items:
            type: ref
            target: test-case
    related_experiments:
        type: list
        items:
            type: ref
            target: experiment
    related_metrics:
        type: list
        items:
            type: ref
            target: metric
display:
    order: 95
description: Release scope, validation, rollout, and follow-up records.
include:
    - "knowledge/releases/**/*.md"
create:
    directory: knowledge/releases
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/release.md
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

# Releases

Release planning, validation, rollout, and follow-up records.
