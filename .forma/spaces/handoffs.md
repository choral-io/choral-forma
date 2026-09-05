---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Handoffs
description: Team-shared continuation context; accepted decisions and Task state remain in their canonical entries.
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
        scope:
            type: string
        type:
            type: string
        owners:
            type: list
            items:
                type: member
        tags:
            type: list
            items:
                type: string
display:
    order: 95
    icon: folder-tree
    color: "#64748B"
include:
    - "knowledge/handoffs/**/*.md"
conventions:
    titleField: fields.title
    summaryField: fields.summary
---

# Handoffs

Team-shared handoffs live in `knowledge/handoffs/` by default. Follow [[guidelines/local-worklist-and-execution]] for placement, the continuation structure, and resumption checks. Sharing continuation context does not accept its proposals or change Task state.

Personal shared and personal local handoffs retain their existing workspace placement and indexing rules. This space does not import either directory.
