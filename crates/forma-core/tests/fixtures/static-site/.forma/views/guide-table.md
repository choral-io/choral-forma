---
schemaVersion: 1
kind: view
mode: table
title: Guide Table
source:
    type: pages
    taxonomy:
        spaces:
            - guides
table:
    columns:
        - field: fields.title
          label: Title
          link:
              target: entry
        - field: fields.summary
          label: Summary
        - field: fields.status
          label: Status
sort:
    - field: fields.title
      direction: asc
---

# Guide Table

<!-- forma:content -->
