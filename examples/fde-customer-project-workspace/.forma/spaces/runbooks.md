---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Runbooks
display:
    order: 90
description: Repeatable investigation or operating sequences that stay within the approved local workflow.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "runbooks/**/*.md"
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
            value: runbook
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
        sources:
            type: list
            items:
                type: entryRef
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "runbooks"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/runbook.md"
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

# Runbooks

A runbook describes a repeatable sequence and its stop conditions. It does not grant permission to perform external or production actions.

<!-- forma:content -->
