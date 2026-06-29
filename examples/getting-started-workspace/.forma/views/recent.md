---
schemaVersion: 1
kind: view
mode: list
title: Recent
display:
  order: 40
description: Recently updated getting-started pages across the main workspace spaces.
source:
  type: pages
  taxonomy:
    spaces:
      - notes
      - tasks
      - members
      - guidelines
sort:
  - field: fields.updatedAt
    direction: desc
  - field: fields.createdAt
    direction: desc
---

# Recent

Review recently updated getting-started pages without changing the underlying files.

<!-- forma:content -->
