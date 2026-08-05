---
schemaVersion: 1
kind: view
mode: list
title: Work Items
display:
    order: 20
description: Customer asks, issues, proposals, decisions, and tasks.
source:
    type: pages
    taxonomy:
        spaces:
            - engagement-content
sort:
    - field: fields.status
      direction: asc
    - field: source.path
      direction: asc
---

# Work Items

This is a team-defined read-only view, not a built-in project-management board.

<!-- forma:content -->
