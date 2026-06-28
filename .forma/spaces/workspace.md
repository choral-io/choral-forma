---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Workspace
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
                type: entryRef
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
description: Shared member workspace entry pages.
include:
    - "knowledge/workspace/*/index.md"

conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Workspace

Shared member workspace entry pages.

This space intentionally indexes only member workspace entry pages. Handoffs, research notes, and local workspace material are working context until a human explicitly promotes them into a canonical project space. Shared entries may mention workspace-local paths as plain code text when needed, but must not create links or frontmatter references to member local files.
