---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Test Cases
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
        priority:
            type: string
        automation:
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
        relatedTasks:
            type: list
            items:
                type: ref
                target: task
        coversUserStories:
            type: list
            items:
                type: ref
                target: user-story
        coversProduct:
            type: list
            items:
                type: ref
display:
    order: 85
description: Reusable acceptance and validation cases.
include:
    - "knowledge/test-cases/**/*.md"
create:
    directory: knowledge/test-cases
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/test-case.md
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

# Test Cases

Reusable validation cases for product, workflow, and release confidence.
