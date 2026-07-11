---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
    - "*.md"
schema:
    type: object
    fields:
        title:
            type: string
    status:
        type: string
    owner:
        type: noteRef
conventions:
    titleField: fields.title
---

# Notes
