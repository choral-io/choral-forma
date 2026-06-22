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
        status:
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
        blockedBy:
            type: list
            items:
                type: ref
                target: task
        relatedTo:
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
        reportedBy:
            type: string
        affectedArea:
            type: string
display:
    order: 80
description: Delivery tasks tracked as repository Markdown.
guidelines:
    - knowledge/guidelines/forma-knowledge-operations.md
    - knowledge/guidelines/task-selection.md
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
        status:
            default: backlog
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
        blockedBy:
            default: []
        relatedTo:
            default: []
        severity:
            default: ""
        sprint:
            default: ""
        reportedBy:
            default: ""
        affectedArea:
            default: ""
conventions:
    titleField: title
    summaryField: summary
---

# Tasks

Delivery tasks tracked as repository Markdown.
