---
scope: project
type: task
title: Design Forma Policy Runtime
summary: Define the minimal machine-readable policy model for write-capable Forma operations.
priority: P1
severity:
value: H
module: core

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - policy
    - operations
    - tasks

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
affected_area: Forma policy runtime
---

# Design Forma Policy Runtime

## Goal

Define the minimal machine-readable policy model for write-capable Forma operations.

## Sources

- [[product/product-direction]]
- [[architecture/forma-policy-and-operation-model]]
- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]

## In Scope

- Identify the first operation that should consume policy definitions.
- Define the smallest policy shape needed for task workflow checks.
- Keep policy responsibilities separate from schema, guidelines, invariants, and operation execution.

## Out Of Scope

- Implementing a general policy engine.
- Implementing write operations before a reviewable operation flow exists.
- Replacing human-readable guidelines with machine-readable policy files.

## Acceptance Criteria

- The task defines the first policy consumer operation.
- The task separates schema, policy, guideline, invariant, and operation responsibilities.
- The task avoids introducing a broad policy engine before a concrete write operation exists.
