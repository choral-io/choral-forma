---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
    - "*.md"
    - "notes/**/*.md"
schema:
    type: object
    fields:
        title:
            type: string
        status:
            type: string
        owner:
            type: noteRef
        tags:
            type: list
            items:
                type: string
conventions:
    titleField: fields.title
---

# Notes
