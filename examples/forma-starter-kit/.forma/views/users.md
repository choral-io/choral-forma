---
schemaVersion: 1
kind: view
mode: table
title: Users
display:
  order: 60
description: Example people referenced by the starter workspace.
source:
  type: pages
  taxonomy:
    spaces:
      - users
table:
  columns:
    - field: fields.name
      label: Name
    - field: fields.description
      label: Description
    - field: fields.createdAt
      label: Created
sort:
  - field: fields.name
    direction: asc
---

# Users

List example people referenced by starter tasks and pages.

<!-- forma:content -->
