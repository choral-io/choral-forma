---
title: "Workspace Operations"
summary: "General operating boundary for the product R&D workspace."
owners:
  - members/ava-patel
reviewers:
  - members/noah-kim
tags:
  - guidelines
  - workspace
skill:
  id: product-rd-workspace-operations
  title: Product R&D Workspace Operations
  description: Use when an Agent needs to inspect, maintain, or classify shared product R&D workspace content.
  triggers:
    - product workspace maintenance
    - product rd content
    - local-only promotion
  order: 20
createdAt: "2026-06-29T00:00:00Z"
updatedAt: "2026-06-29T00:00:00Z"
---

# Workspace Operations

## Guidance

1. Keep Markdown files as the source of truth.
2. Use `.forma.md` and `.forma/spaces/*.md` to discover workspace structure before choosing a target path.
3. Prefer updating a canonical page before creating a duplicate.
4. Keep personal drafts and scratch notes outside the Forma-managed workspace until the team approves promotion into shared records.
5. Do not treat example-specific tasks or members as Forma built-ins.
6. After shared content edits, run `forma check --json` and run `forma workspace health --json` when relationships changed.

## Template Use

When copying this workspace, replace the sample product, members, release dates, tasks, metrics, research notes, and validation records before treating it as a real team workspace. `Atlas Notes`, Ava Patel, Noah Kim, and the planning beta are example facts, not reusable project facts.

## Local Configuration

Use `.forma/local/` only for local Forma configuration or machine-specific overrides. Do not put product knowledge, research notes, task drafts, or personal triage content in `.forma/local/`, and do not reference `.forma/local/` from shared records.

## Configuration Changes

Before changing spaces, templates, views, field names, or relationship types, describe the affected content paths and expected migration impact. After config changes, run `forma config inspect --json`, `forma check --json`, and `forma workspace health --json`.
