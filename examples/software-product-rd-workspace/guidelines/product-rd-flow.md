---
title: "Product R&D Flow"
summary: "How to select, execute, review, and report product development work."
owners:
  - members/noah-kim
reviewers:
  - members/ava-patel
tags:
  - guidelines
  - delivery
skill:
  id: product-rd-flow
  title: Product R&D Flow
  description: Use when an Agent needs to choose, inspect, refine, or review product development tasks.
  triggers:
    - choose product task
    - inspect release readiness
    - review task board
    - prepare release evidence
  order: 30
createdAt: "2026-06-29T00:00:00Z"
updatedAt: "2026-06-29T00:00:00Z"
---

# Product R&D Flow

## Task Selection

Choose work from the task board before loose ideas. Prefer tasks with `status: ready` and `readiness: ready` unless the user asks for backlog refinement.

## Review

Review should compare the work against product scope, architecture constraints, linked validation cases, and release evidence. Report findings first. If no issues are found, state remaining risks and checks run.

## Evidence Flow

Use research evidence before changing product direction. Use product direction before changing release scope. Use release scope before changing validation or readiness claims. If a task changes scope, update the linked product, research, validation, metric, or release records in the same reviewed slice when needed.

## Status Changes

Do not change `status`, `readiness`, `blockedBy`, owners, assignees, reviewers, or release evidence without explicit approval.

## Shared Record Changes

Changes to shared product records should be small, reviewable, and backed by linked evidence when they affect release scope, status, ownership, or validation records.

## Human And Agent Boundaries

Humans decide product direction, release scope, readiness, ownership, and status changes. Agents may inspect, summarize, draft, and apply approved edits, but should not silently promote research into accepted product direction or move tasks between workflow states.
