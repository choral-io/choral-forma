---
schemaVersion: 1
kind: view
mode: list
title: Recent
display:
  order: 30
description: Recently updated product R&D workspace pages.
source:
  type: pages
  taxonomy:
    spaces:
      - product
      - research
      - architecture
      - decisions
      - design
      - tasks
      - releases
      - validation
      - metrics
      - experiments
      - guidelines
sort:
  - field: fields.updatedAt
    direction: desc
  - field: fields.createdAt
    direction: desc
---

# Recent

Recently updated product R&D workspace pages.

<!-- forma:content -->
