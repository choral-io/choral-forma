---
schemaVersion: 1
kind: view
mode: list
title: Evidence Review
display:
  order: 10
description: Evidence cards, source projects, reviews, and revalidation records.
source:
  type: pages
  taxonomy:
    spaces:
      - practice-content
sort:
  - field: fields.status
    direction: asc
  - field: source.path
    direction: asc
---

# Evidence Review

This is a read-only projection for the team-defined review workflow.

<!-- forma:content -->
