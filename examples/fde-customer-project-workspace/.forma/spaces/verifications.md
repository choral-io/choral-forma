---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Verification Records
display:
    order: 110
description: Stable evidence of commands, expected results, actual results, and known failure conditions.
guidelines:
    - guidelines/partition-contracts.md
include:
    - "verifications/**/*.md"
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
            value: verification
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
        result:
            type: string
            required: true
        exitStatus:
            type: string
            required: true
        commands:
            type: list
            items:
                type: string
            required: true
        expected:
            type: list
            items:
                type: string
            required: true
        failureConditions:
            type: list
            items:
                type: string
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
        sources:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "verifications"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/verification.md"
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

# Verification Records

Verification records preserve reproducible commands, stable output, and failure conditions. They do not claim a production deployment.

<!-- forma:content -->
