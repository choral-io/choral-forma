---
schemaVersion: 1
kind: term
taxonomy: spaces
id: measurements
title: Measurements
include:
    - "measurements/**/*.md"
schema:
    type: object
    fields:
        title:
            type: string
            required: true
        ratio:
            type: number
            required: true
        count:
            type: integer
            required: true
        ordinalWidth:
            type: integer
            required: true
        ordinal:
            type: string
            required: true
---

# Measurements

<!-- forma:content -->
