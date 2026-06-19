---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
schema:
    type: object
    fields:
        kind:
            type: string
        scope:
            type: string
        title:
            type: string
        summary:
            type: string
        type:
            type: string
        priority:
            type: string
        value:
            type: string
        module:
            type: string
        effort:
            type: string
        readiness:
            type: string
        owners:
            type: list
            items:
                type: ref
                target: member
        assignees:
            type: list
            items:
                type: ref
                target: member
        reviewers:
            type: list
            items:
                type: ref
                target: member
        tags:
            type: list
            items:
                type: string
        blocked_by:
            type: list
            items:
                type: ref
                target: task
        related_to:
            type: list
            items:
                type: ref
        sources:
            type: list
            items:
                type: ref
        severity:
            type: string
        sprint:
            type: string
        reported_by:
            type: string
        affected_area:
            type: string
display:
    order: 80
description: Delivery tasks tracked as repository Markdown.
include:
    - "knowledge/tasks/**/*.md"
create:
    directory: knowledge/tasks
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/task.md
    inputs:
        title:
            required: true
        slug:
            default: "{{ input.title }}"
            transform: slugify
        scope:
            default: project
        summary:
            default: ""
        type:
            default: task
        priority:
            default: P2
        value:
            default: M
        module:
            default: knowledge
        effort:
            default: M
        readiness:
            default: needs-refinement
        owners:
            default: []
        assignees:
            default: []
        reviewers:
            default: []
        tags:
            default: []
        blocked_by:
            default: []
        related_to:
            default: []
        severity:
            default: ""
        sprint:
            default: ""
        reported_by:
            default: ""
        affected_area:
            default: ""
conventions:
    titleField: title
    summaryField: summary
---

# Tasks

Delivery tasks tracked as repository Markdown.
