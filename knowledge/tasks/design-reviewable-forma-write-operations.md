---
scope: project
type: task
title: Design Reviewable Forma Write Operations
summary: Define proposal, dry-run, apply, and verification behavior for future writable Forma workflows.
priority: P1
severity:
value: H
module: core

owners:
    - "members/Tiscs"
assignees:
    - "members/Tiscs"
reviewers: []
tags:
    - forma
    - writable
    - operations
    - proposals

effort: M
status: backlog
readiness: needs-refinement
sprint:

blocked_by: []
related_to:
    - "product/product-direction"
    - "architecture/forma-policy-and-operation-model"
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"

reported_by:
affected_area: Forma write operations
---

# Design Reviewable Forma Write Operations

## Goal

Define proposal, dry-run, apply, and verification behavior for future writable Forma workflows.

## Sources

- [[product/product-direction]]
- [[architecture/forma-policy-and-operation-model]]
- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]

## In Scope

- Define the operation flow from proposed change to applied Markdown edit.
- Identify pre-apply and post-apply checks for CLI, RPC, WebApp, and Agent surfaces.
- Define how proposed changes are reviewed before file writes.

## Out Of Scope

- Implementing write operations.
- Implementing proposal persistence.
- Implementing policy runtime enforcement.

## Acceptance Criteria

- The task defines the operation flow from proposed change to applied Markdown edit.
- The task identifies which checks run before and after apply.
- The task explains how CLI, RPC, WebApp, and Agents share the same write boundary.
