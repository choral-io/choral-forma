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
        startsOn:
            type: date
        endsOn:
            type: date
        predecessors:
            type: list
            items:
                type: noteRef
        percentComplete:
            type: integer
        tags:
            type: list
            items:
                type: string
conventions:
    titleField: fields.title
---

# Notes
