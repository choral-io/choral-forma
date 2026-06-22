---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Members
schema:
    type: object
    fields:
        kind:
            type: string
        title:
            type: string
        summary:
            type: string
        member_id:
            type: string
        display_name:
            type: string
        scope:
            type: string
        type:
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
display:
    order: 90
description: Shared member-facing workspace notes. Local-only member files remain ignored by Git.
include:
    - "knowledge/members/**/*.md"
create:
    directory: knowledge/members
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/member-note.md
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

# Members

Shared member profiles and shared workspace notes.
