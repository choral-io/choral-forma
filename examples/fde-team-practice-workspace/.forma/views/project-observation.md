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
            - customers
            - projects
            - communications
            - portfolio-observation
sort:
    - field: fields.lastHealthStatus
      direction: asc
    - field: source.path
      direction: asc
---

# Project Observation

Only de-identified source metadata, stage, owner role, blocker class, health status, and practice signal belong in this team-defined observation layer.

<!-- forma:content -->
