---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Practice Content
display:
    order: 10
description: Team-defined Markdown records for de-identified source indexes, evidence, review, practice, roles, and observation metadata.
include:
    - "overview/**/*.md"
    - "customers/**/*.md"
    - "projects/**/*.md"
    - "communications/**/*.md"
    - "evidence-cards/**/*.md"
    - "verification/**/*.md"
    - "proposals/**/*.md"
    - "reviews/**/*.md"
    - "patterns/**/*.md"
    - "guidelines/**/*.md"
    - "reusable-templates/**/*.md"
    - "revalidations/**/*.md"
    - "roles/**/*.md"
    - "portfolio-observation/**/*.md"
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
        type:
            type: string
        status:
            type: string
        synthetic:
            type: string
        engagementKey:
            type: string
        sourceEngagementKey:
            type: string
        customerKey:
            type: string
        projectKey:
            type: string
        environment:
            type: string
        environmentDifference:
            type: string
        sourceId:
            type: string
        sourceKind:
            type: string
        result:
            type: string
        exitStatus:
            type: string
        decision:
            type: string
        reason:
            type: string
        revalidationReason:
            type: string
        applicability:
            type: string
        limits:
            type: string
        counterexample:
            type: string
        allowedShare:
            type: string
        humanReviewRole:
            type: string
        ownerRole:
            type: string
        stage:
            type: string
        blockerClass:
            type: string
        lastHealthStatus:
            type: string
        tags:
            type: list
            items:
                type: string
        relatedTo:
            type: list
            items:
                type: entryRef
        sources:
            type: list
            items:
                type: entryRef
        sourceProjects:
            type: list
            items:
                type: entryRef
        results:
            type: list
            items:
                type: entryRef
        customerRef:
            type: entryRef
        projectRef:
            type: entryRef
        projectRefs:
            type: list
            items:
                type: entryRef
        commands:
            type: list
            items:
                type: string
        expected:
            type: list
            items:
                type: string
        actual:
            type: list
            items:
                type: string
        failureConditions:
            type: list
            items:
                type: string
create:
    directory: "evidence-cards"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/entry.md"
    inputs:
        title:
            required: true
        summary:
            default: ""
        slug:
            type: string
            default: "{{ input.title }}"
            transform: slugify
        type:
            default: evidence-card
        status:
            default: draft
conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Practice Content

The directory names are explicit team conventions. Only the configured `practice-content` group is a Forma content group.

<!-- forma:content -->
