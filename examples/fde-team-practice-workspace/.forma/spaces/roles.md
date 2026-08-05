---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Roles
display:
    order: 130
description: Team-defined responsibility records for source FDEs, practice reviewers, and portfolio observers.
guidelines:
    - guidelines/practice-partition-contracts.md
include:
    - "roles/**/*.md"
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
            value: role
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
        ownerRole:
            type: string
            required: true
        relatedTo:
            type: list
            items:
                type: entryRef
            required: true
create:
    directory: "roles"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/role.md"
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

# Roles

Roles state responsibility and review boundaries. They do not grant access or implement RBAC.

<!-- forma:content -->
