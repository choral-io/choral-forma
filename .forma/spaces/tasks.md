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
            type: priority
        value:
            type: deliveryValue
        module:
            type: string
        effort:
            type: effort
        status:
            type: taskStatus
        readiness:
            type: readiness
        owners:
            type: list
            items:
                type: member
        assignees:
            type: list
            items:
                type: member
        reviewers:
            type: list
            items:
                type: member
        tags:
            type: list
            items:
                type: string
        blockedBy:
            type: list
            items:
                type: task
        relatedTo:
            type: list
            items:
                type: entryRef
        sources:
            type: list
            items:
                type: entryRef
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
    - knowledge/guidelines/forma-workspace-operations.md
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
            type: select
            default: P2
            options:
                - value: P0
                  label: P0
                - value: P1
                  label: P1
                - value: P2
                  label: P2
                - value: P3
                  label: P3
        value:
            type: select
            default: M
            options:
                - value: H
                  label: H
                - value: M
                  label: M
                - value: L
                  label: L
        module:
            default: content
        effort:
            type: select
            default: M
            options:
                - value: S
                  label: S
                - value: M
                  label: M
                - value: L
                  label: L
        status:
            type: select
            default: backlog
            options:
                - value: backlog
                  label: Backlog
                - value: ready
                  label: Ready
                - value: doing
                  label: Doing
                - value: reviewing
                  label: Reviewing
                - value: blocked
                  label: Blocked
                - value: done
                  label: Done
                - value: cancelled
                  label: Cancelled
        readiness:
            type: select
            default: needs-refinement
            options:
                - value: needs-refinement
                  label: Needs Refinement
                - value: ready
                  label: Ready
                - value: blocked
                  label: Blocked
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
