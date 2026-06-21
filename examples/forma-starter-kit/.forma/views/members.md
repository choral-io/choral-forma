---
schemaVersion: 1
kind: view
mode: table
title: Members
display:
  order: 60
description: Example team members referenced by the starter workspace.
source:
  type: pages
  taxonomy:
    spaces:
      - members
table:
  columns:
    - field: fields.name
      label: Name
    - field: fields.description
      label: Description
    - field: fields.responsibilities
      label: Responsibilities
sort:
  - field: fields.name
    direction: asc
---

# Members

List example team members referenced by starter tasks and pages.

<!-- forma:content -->
