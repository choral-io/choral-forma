---
schemaVersion: 1
kind: task
scope: project
title: Define Cross-Surface Capability Matrix
summary: Define testable capability claims and intentional Host differences across CLI, WebApp, VS Code, and Zed.
type: task
priority: P1
value: H
module: app
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
    - parity
    - adapters
blockedBy:
    - "tasks/generalize-taxonomy-neutral-page-model"
    - "tasks/design-cli-editor-compatibility-window"
relatedTo:
    - "planning/forma-product-value-gap-roadmap"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/validate-shared-graph-view-cross-host-parity"
    - "tasks/implement-zed-extension-mvp"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: CLI, WebApp, VS Code, and Zed capability parity
---

# Define Cross-Surface Capability Matrix

## Goal

Define which Forma capabilities are shared product semantics, which are Host-native adaptations, and what evidence is required before claiming support on each surface.

## Observed Baseline

Shared Core operations exist, but the WebApp is read-only, VS Code provides the richest navigation and preview experience, and Zed currently provides navigation only. Graph parity has focused validation, while broader capability claims remain distributed across docs and tasks.

## In Scope

- Inventory current Core operations and user-visible capabilities by surface.
- Classify required parity, acceptable Host variation, intentional omission, and unsupported behavior.
- Link each claim to contract, unit/integration, packaged, and real-Host evidence.
- Define release-gate and documentation update rules for matrix changes.
- Use protocol capabilities rather than package-version assumptions.

## Out Of Scope

- Implementing missing surface features.
- Pixel-identical UI across editors.
- Treating every Host API difference as a product defect.
- Expanding Zed before the taxonomy-neutral Page and compatibility contracts are ready.

## Acceptance Criteria

- One concise matrix covers CLI, WebApp, VS Code, and Zed.
- Every claimed shared capability names its authoritative Core/RPC contract.
- Intentional Host differences have rationale and validation ownership.
- Missing evidence is reported as unverified rather than implied support.
- Follow-up tasks are ordered without duplicating Host-independent semantics.
