---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
display:
    order: 80
description: Concrete work items with status and local links to the ask, issue, decision, or verification.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "tasks/**/*.md"
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
            value: task
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
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "tasks"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/task.md"
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

# Tasks

A task is executable work. It should link to the record that made the work necessary and state its current status.

<!-- forma:content -->
