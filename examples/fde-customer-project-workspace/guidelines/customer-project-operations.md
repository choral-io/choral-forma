---
scope: workspace
title: Customer Project Operations
summary: Read-only Agent workflow and human approval boundaries for the synthetic customer project.
tags:
    - fde
    - synthetic
    - boundaries
skill:
    id: customer-project-operations
    title: Customer Project Operations
    description: Inspect the current synthetic customer project, run its deterministic fixture, and stop before human-approved writes or external actions.
    projection: section
    order: 10
relatedTo:
    - overview/engagement-map
---

# Customer Project Operations

## Agent Skill

Before making a recommendation, read the current customer facts, communications indexes, issues, decisions, and applicable runbook. Run Forma checks and the local fixture from the workspace root.

Agents may inspect, summarize, run tests, and prepare previews. They must not modify customer facts, decisions, code, configuration, external systems, or production state. `ENG-SYN-001` is a narrative key only and must never be used as a path, authorization, join, synchronization, or promotion mechanism.

External tickets, messages, meetings, and repositories remain external systems. Their Markdown entries are indexes and do not grant access.

## Verification Gate

The fixture must pass the staging positive path, demonstrate the expected production-naive failure, and pass the adjusted production path before the verification entry is considered complete.
