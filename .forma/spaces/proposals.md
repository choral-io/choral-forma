---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Proposals
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
        sources:
            type: list
            items:
                type: ref
        relatedTo:
            type: list
            items:
                type: ref
display:
    order: 75
description: Reviewable content, task, and decision proposals before canonical conversion.
include:
    - "knowledge/proposals/**/*.md"
create:
    directory: knowledge/proposals
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/proposal.md
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

# Proposals

Reviewable proposed changes before conversion into canonical content, tasks, or decisions.
