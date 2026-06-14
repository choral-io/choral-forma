---
schemaVersion: 1
kind: view
mode: list
title: Recent
display:
  order: 40
description: Recently updated starter guide pages.
source:
  type: pages
  taxonomy:
    spaces:
      - notes
sort:
  - field: fields.updatedAt
    direction: desc
  - field: fields.createdAt
    direction: desc
---

# Recent

Review recently updated guide pages without changing the underlying files.

<!-- forma:content -->
