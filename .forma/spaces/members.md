---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Members
display:
    order: 30
description: Shared member-facing workspace notes. Local-only member files remain ignored by Git.
include:
    - "knowledge/members/**/*.md"
    - "knowledge/workspace/*/handoffs/**/*.md"
    - "knowledge/workspace/*/research/**/*.md"
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
