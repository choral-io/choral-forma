---
schemaVersion: 1
kind: task
scope: project
title: Design Markdown Import And Normalization Flow
summary: Define a reviewable, non-destructive path for mapping existing Markdown into Forma spaces and normalizing it in bounded slices.
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
    - import
    - normalization
blockedBy:
    - "tasks/design-guided-knowledge-modeling-flow"
relatedTo:
    - "planning/forma-product-value-gap-roadmap"
    - "product/product-direction"
    - "tasks/design-reviewable-forma-write-operations"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Existing Markdown adoption and normalization
---

# Design Markdown Import And Normalization Flow

## Goal

Define how Forma inventories existing Markdown, proposes space and field mappings, and normalizes only approved files without obscuring source ownership.

## Observed Baseline

`forma init` creates a minimal bootstrap and `forma create` creates one configured entry. Existing corpora require manual classification, metadata repair, reference normalization, and migration.

## In Scope

- Inventory files, metadata shapes, link forms, collisions, and candidate space membership.
- Map source fields and paths to a guided workspace model with confidence and exceptions.
- Define dry-run, diff, apply, idempotency, interruption, and rollback boundaries.
- Preserve unsupported files and unknown fields unless the user chooses an explicit transformation.
- Separate generic Markdown normalization from product-specific third-party imports.

## Out Of Scope

- Implementing import or normalization.
- Guaranteed compatibility with a specific knowledge application.
- Destructive bulk cleanup or silent body rewrites.
- Schema evolution after the initial mapping.

## Acceptance Criteria

- The design covers discovery, mapping, conflict reporting, partial selection, apply, and verification.
- Re-running an accepted normalization plan is safe and explainable.
- Fixtures cover clean, inconsistent, ambiguous, localized, and partially unsupported corpora.
- The contract produces inputs for [[tasks/design-schema-evolution-migration-contract]].
