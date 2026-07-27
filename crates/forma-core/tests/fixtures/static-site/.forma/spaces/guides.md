---
schemaVersion: 1
kind: term
taxonomy: spaces
id: guides
title: Guides
description: Public fixture guides.
include:
    - "content/guides/**/*.md"
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
        status:
            type: string
conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Guides

<!-- forma:content -->
