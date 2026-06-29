---
scope: project
type: task
title: Design Forma Policy Runtime
summary: Define the minimal machine-readable policy gates for concrete write-capable Forma operations.
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

blockedBy:
    - "tasks/design-reviewable-forma-write-operations"
relatedTo:
    - "product/product-direction"
    - "architecture/forma-policy-and-operation-model"
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "tasks/design-reviewable-forma-write-operations"

reportedBy:
affectedArea: Forma policy runtime
---

# Design Forma Policy Runtime

## Goal

Define the minimal machine-readable policy gates for concrete write-capable Forma operations.

## Context

Policy runtime work should follow an accepted reviewable write-operation design. Without a concrete operation consumer, policy design is likely to become a broad abstract engine instead of a small operation-facing gate.

The first policy slice should support product R&D constraints that the current project actually needs: task status/readiness consistency, local-only boundaries, reference health, and approval requirements for writes. It should not try to encode the old `knowledge-workflow` skill model.

## Sources

- [[product/product-direction]]
- [[architecture/forma-policy-and-operation-model]]
- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]

## In Scope

- Identify the first operation that should consume policy definitions.
- Define the smallest policy shape needed for concrete write-operation checks.
- Cover only the first useful gates for current product work, such as status/readiness consistency, local-only boundaries, reference health, and explicit approval.
- Keep policy responsibilities separate from schema, guidelines, invariants, and operation execution.

## Out Of Scope

- Implementing a general policy engine.
- Implementing write operations before a reviewable operation flow exists.
- Replacing human-readable guidelines with machine-readable policy files.
- Recreating old `knowledge-workflow` delivery, capture, or personal worklist rules as policy.

## Acceptance Criteria

- The task defines the first policy consumer operation.
- The task separates schema, policy, guideline, invariant, and operation responsibilities.
- The task avoids introducing a broad policy engine before a concrete write operation exists.
- The task limits policy scope to the smallest gates needed by the first write operation and current product R&D workflow.
