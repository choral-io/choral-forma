---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Workspace Support
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
        owners:
            type: list
            items:
                type: member
        tags:
            type: list
            items:
                type: string
        sources:
            type: list
            items:
                type: ref
        assignees:
            type: list
            items:
                type: member
        reviewers:
            type: list
            items:
                type: member

display:
    order: 100
description: Shared workspace handoffs and research support notes.
include:
    - "knowledge/workspace/*/handoffs/**/*.md"
    - "knowledge/workspace/*/research/**/*.md"

conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Workspace Support

Shared handoffs and support research notes.
