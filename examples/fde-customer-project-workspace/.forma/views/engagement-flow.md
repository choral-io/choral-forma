---
schemaVersion: 1
kind: view
mode: list
title: Engagement Flow
display:
  order: 10
description: All configured Markdown context for the synthetic engagement.
source:
  type: pages
  taxonomy:
    spaces:
      - engagement-content
      - engineering
sort:
  - field: fields.status
    direction: asc
  - field: source.path
    direction: asc
---

# Engagement Flow

The view is a read-only projection over the two explicitly configured content groups.

<!-- forma:content -->
