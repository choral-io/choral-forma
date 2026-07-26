---
schemaVersion: 1
kind: term
id: cases
taxonomy: spaces
title: Validation Cases
schema:
    type: object
    fields:
        kind:
            type: string
        title:
            type: string
        summary:
            type: string
        status:
            type: caseStatus
        priority:
            type: priority
        area:
            type: caseArea
        surfaces:
            type: list
            items:
                type: string
        automation:
            type: automationLevel
        sampleRefs:
            type: list
            items:
                type: sample
        viewPaths:
            type: list
            items:
                type: string
        operations:
            type: list
            items:
                type: string
        assertionIds:
            type: list
            items:
                type: string
        tags:
            type: list
            items:
                type: string
display:
    order: 10
description: Executable validation specifications for Forma behavior.
include:
    - "cases/**/*.md"
create:
    directory: cases
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/case.md
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

# Validation Cases

Internal validation specifications. Detailed procedure and evidence remain in each Markdown body.
