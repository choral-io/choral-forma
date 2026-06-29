---
schemaVersion: 1
kind: view
mode: list
title: Notes
display:
  order: 10
description: All notes in the minimal workspace.
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

# Notes

All notes in the minimal workspace.

<!-- forma:content -->
