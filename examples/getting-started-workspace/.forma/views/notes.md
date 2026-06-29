---
schemaVersion: 1
kind: view
mode: table
title: Notes
display:
  order: 30
description: Starter guide and feature demonstration notes.
source:
  type: pages
  taxonomy:
    spaces:
      - notes
table:
  columns:
    - field: fields.title
      label: Title
    - field: fields.summary
      label: Summary
    - field: fields.createdAt
      label: Created
sort:
  - field: fields.createdAt
    direction: desc
---

# Notes

Browse guide and feature demonstration pages as a structured table.

<!-- forma:content -->
