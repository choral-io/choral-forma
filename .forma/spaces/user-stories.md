---
schemaVersion: 1
kind: term
taxonomy: spaces
title: User Stories
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
        tags:
            type: list
            items:
                type: string
        actors:
            type: list
            items:
                type: string
        relatedProduct:
            type: list
            items:
                type: ref
        relatedTasks:
            type: list
            items:
                type: ref
                target: task
        relatedTestCases:
            type: list
            items:
                type: ref
                target: test-case
        relatedMetrics:
            type: list
            items:
                type: ref
                target: metric
display:
    order: 45
description: User, actor, and workflow stories that connect product intent to delivery.
include:
    - "knowledge/user-stories/**/*.md"
create:
    directory: knowledge/user-stories
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/user-story.md
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

# User Stories

Actor-centered stories and use cases for product and delivery planning.
