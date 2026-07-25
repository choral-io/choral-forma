---
schemaVersion: 1
kind: task
scope: project
title: Design Schema Evolution And Migration Contract
summary: Define compatibility, impact analysis, migration planning, and verification when Forma workspace schemas change.
type: task
priority: P1
value: H
module: core
effort: M
status: backlog
readiness: blocked
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - product-value
    - schema
    - migration
blockedBy:
    - "tasks/design-markdown-import-normalization-flow"
relatedTo:
    - "planning/forma-product-value-gap-roadmap"
    - "product/product-direction"
    - "architecture/forma-policy-and-operation-model"
    - "tasks/design-reviewable-forma-write-operations"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Schema lifecycle and content migrations
---

# Design Schema Evolution And Migration Contract

## Goal

Define how maintainers understand and safely apply the content impact of a schema or semantic-type change.

## Observed Baseline

Forma validates entries against the effective current schema and emits diagnostics. It does not classify schema compatibility, enumerate affected entries before a change, or produce migration plans.

## In Scope

- Classify additive, tightening, renaming, type-changing, reference-changing, and removal changes.
- Define impact output for affected spaces, entries, views, templates, references, and adapters.
- Define migration plans, dry-run diffs, checkpoints, interruption handling, and post-migration verification.
- Preserve unknown frontmatter, Markdown bodies, comments, and ordering where the accepted write contract allows.
- Specify old/new schema fixtures and release compatibility evidence.

## Out Of Scope

- Implementing migrations.
- Arbitrary executable migration scripts.
- Automatic destructive conversion without approval.
- General versioning of every Markdown document.

## Acceptance Criteria

- Each compatibility class has an observable impact and required action.
- A migration plan names every affected file and validation gate before apply.
- Failure and recovery behavior is explicit.
- Fixtures prove unchanged, migrated, rejected, and partially recoverable cases.
- The design composes with the shared reviewable write-operation contract.
