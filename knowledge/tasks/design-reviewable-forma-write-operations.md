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
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - writable
    - operations
    - proposals

effort: M
status: ready
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "product/product-direction"
    - "architecture/forma-policy-and-operation-model"
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "tasks/design-forma-policy-runtime"
    - "tasks/design-reviewable-knowledge-change-proposals"
    - "tasks/design-reviewable-operation-proposal-flow"
    - "tasks/design-metadata-edit-deprecate-operations"

reportedBy:
affectedArea: Forma write operations
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
- Define the minimal shared operation contract used by CLI, RPC, WebApp, and Agent surfaces.
- Choose the first concrete write-operation family to design against, using small structured metadata or task-state edits before broad Markdown body mutation.
- Identify pre-apply and post-apply checks for CLI, RPC, WebApp, and Agent surfaces.
- Define how proposed changes are reviewed before file writes.
- Define how direct Git diffs, generated dry-runs, and future persisted proposals relate without making proposal persistence a prerequisite.
- Identify follow-up tasks that become unblocked by the accepted write-operation design.

## Out Of Scope

- Implementing write operations.
- Implementing proposal persistence.
- Implementing policy runtime enforcement.
- Designing AI Chat behavior.
- Designing WebApp-specific interaction details beyond the shared operation boundary.
- Designing broad Markdown body patching, move, rename, delete, or automatic fix commands.

## Design Direction

This task should produce the core operation model before product surfaces specialize it.

The first design pass should assume this shape:

```text
read workspace
-> build proposed change
-> validate schema and current invariants
-> optionally evaluate applicable policy hooks when they exist
-> return dry-run result with diagnostics and file diff
-> require explicit approval at the adapter boundary
-> apply file edits
-> run post-apply verification
-> return verification evidence
```

The first concrete operation family should be narrow and structured. Good candidates are task metadata transitions or single-entry frontmatter updates because they exercise the source-of-truth and review boundary without requiring arbitrary Markdown body editing.

The design should keep these concepts separate:

- `operation`: executable product capability shared by CLI, RPC, WebApp, and future adapters;
- `proposal`: reviewable representation of a possible change, which may initially be a generated dry-run result rather than a persisted file;
- `policy`: future machine-readable precondition or gate consumed by an operation;
- `guideline`: human- and Agent-readable soft procedure;
- `schema`: metadata shape and type validation;
- `invariant`: workspace consistency check before or after apply.

## Execution Notes

- Start from [[architecture/forma-policy-and-operation-model]] and update it if the accepted operation flow changes the architecture contract.
- Treat [[tasks/design-forma-policy-runtime]] as downstream: policy should attach to a concrete operation consumer after this design exists.
- Treat [[tasks/design-reviewable-operation-proposal-flow]] as downstream WebApp specialization: UI proposal states should not invent a separate write boundary.
- Treat [[tasks/design-reviewable-knowledge-change-proposals]] as overlapping product design. This task may recommend whether that work should be merged, narrowed, or kept as a proposal persistence decision.

## Acceptance Criteria

- The task defines the operation flow from proposed change to applied Markdown edit.
- The task names the first concrete write-operation family and explains why it is narrow enough for P1 design.
- The task defines the shared operation contract at a level useful for CLI `--json`, local RPC, WebApp, and Agents.
- The task identifies which checks run before and after apply.
- The task explains how CLI, RPC, WebApp, and Agents share the same write boundary.
- The task separates generated dry-run results from future persisted proposal records.
- The task states how policy runtime work is sequenced after the operation design.
- The task records follow-up implementation or design tasks with observable acceptance criteria.
