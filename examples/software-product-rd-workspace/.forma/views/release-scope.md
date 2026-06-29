---
schemaVersion: 1
kind: view
mode: table
title: Release Scope
display:
  order: 20
description: Release records and the validation material linked from them.
source:
  type: pages
  taxonomy:
    spaces:
      - releases
table:
  columns:
    - field: fields.title
      label: Release
    - field: fields.status
      label: Status
    - field: fields.version
      label: Version
    - field: fields.date
      label: Date
    - field: fields.relatedTasks
      label: Tasks
    - field: fields.relatedValidation
      label: Validation
sort:
  - field: fields.date
    direction: asc
---

# Release Scope

Release records and the validation material linked from them.

<!-- forma:content -->
