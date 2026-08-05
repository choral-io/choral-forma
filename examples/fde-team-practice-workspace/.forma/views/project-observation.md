---
schemaVersion: 1
kind: view
mode: list
title: Project Observation
display:
  order: 20
description: Minimal synthetic portfolio observation metadata, not a portfolio built into Forma.
source:
  type: pages
  taxonomy:
    spaces:
      - practice-content
sort:
  - field: fields.lastHealthStatus
    direction: asc
  - field: source.path
    direction: asc
---

# Project Observation

Only stage, owner role, blocker class, health status, and practice signal belong in this team-defined observation layer.

<!-- forma:content -->
