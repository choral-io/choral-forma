---
scope: project
type: delivery-ledger
title: Forma Release And Delivery Ledger
summary: Maintained index of published Forma releases, current delivery work, and the evidence that keeps product-workflow status current.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - planning
    - releases
    - delivery
    - governance
sources:
    - "releases/forma-v0.1.0-alpha.13"
    - "releases/forma-v0.1.0-alpha.14"
    - "releases/forma-v0.1.0-alpha.15"
    - "releases/forma-v0.1.0-alpha.16"
    - "releases/forma-v0.1.0-alpha.17"
    - "releases/forma-v0.1.0-alpha.18"
    - "releases/forma-v0.1.0-alpha.19"
    - "releases/forma-v0.1.0-alpha.20"
    - "releases/forma-v0.1.0-alpha.21"
    - "releases/forma-v0.1.22"
    - "releases/forma-v0.1.23"
    - "releases/forma-v0.1.24"
    - "releases/forma-v0.1.25"
    - "planning/forma-product-value-gap-roadmap"
    - "planning/taxonomy-term-presentation-and-graph-color-execution-plan"
    - "tasks/optimize-sticky-headers-in-view-rendering"
    - "tasks/design-guided-knowledge-modeling-flow"
    - "tasks/define-external-product-value-validation"
    - "tasks/validate-shared-graph-view-cross-host-parity"
---

# Forma Release And Delivery Ledger

## Purpose

Keep immutable release records, the active product cutline, and workflow-readiness evidence connected without rewriting release history or treating an old release record as the current roadmap.

Each referenced release record remains the canonical source for its scope and validation. This ledger provides the maintained entry point for sequence, current status, and follow-up work.

## Release Chain

| Version         | Record                             | Position                                          |
| --------------- | ---------------------------------- | ------------------------------------------------- |
| v0.1.0-alpha.13 | [[releases/forma-v0.1.0-alpha.13]] | First editor-extension alpha cutline.             |
| v0.1.0-alpha.14 | [[releases/forma-v0.1.0-alpha.14]] | Historical alpha release evidence.                |
| v0.1.0-alpha.15 | [[releases/forma-v0.1.0-alpha.15]] | Historical editor-experience release evidence.    |
| v0.1.0-alpha.16 | [[releases/forma-v0.1.0-alpha.16]] | Historical performance release evidence.          |
| v0.1.0-alpha.17 | [[releases/forma-v0.1.0-alpha.17]] | Historical release-verification evidence.         |
| v0.1.0-alpha.18 | [[releases/forma-v0.1.0-alpha.18]] | Historical LSP navigation release evidence.       |
| v0.1.0-alpha.19 | [[releases/forma-v0.1.0-alpha.19]] | Historical graph and editor validation evidence.  |
| v0.1.0-alpha.20 | [[releases/forma-v0.1.0-alpha.20]] | Shared Graph milestone.                           |
| v0.1.0-alpha.21 | [[releases/forma-v0.1.0-alpha.21]] | Internal branding and Graph-parity release.       |
| v0.1.22         | [[releases/forma-v0.1.22]]         | First Marketplace-ready Public Preview candidate. |
| v0.1.23         | [[releases/forma-v0.1.23]]         | Previous released Public Preview record.          |
| v0.1.24         | [[releases/forma-v0.1.24]]         | Current released Public Preview record.           |
| v0.1.25         | [[releases/forma-v0.1.25]]         | Planned View navigation and reference candidate.  |

## Current Delivery Cutline

- **Current released baseline:** [[releases/forma-v0.1.24]]. Its record contains the candidate, CI, GitHub Release, published-asset, and known-boundary evidence. Marketplace publication remains unverified.
- **Current candidate:** [[releases/forma-v0.1.25]] is planned. Its entry-link contract, VSIX validation, main-CI, tag, GitHub Release, and Marketplace approval evidence remain open until recorded in that versioned release record.
- **Active validation:** [[tasks/validate-shared-graph-view-cross-host-parity]] remains the active cross-Host Graph evidence boundary.
- **Active delivery:** [[tasks/optimize-sticky-headers-in-view-rendering]] has completed the WebApp Table and Kanban slices; the remaining scope is the VS Code native-preview evaluation.
- **Next product-value slices:** [[tasks/design-guided-knowledge-modeling-flow]] and [[tasks/define-external-product-value-validation]] are ready. Guided modeling remains the first adoption-path design; external validation defines the parallel comparative evidence gate and starts from the authorized case corpus.
- **Architecture dependency:** [[planning/taxonomy-term-presentation-and-graph-color-execution-plan]] keeps taxonomy-neutral presentation, membership, and cross-Host validation boundaries explicit.

## Workflow-Readiness Review

[[metrics/knowledge-workflow-replacement-readiness]] is reviewed after a release or material workspace-workflow change. A ready judgment requires current successful Forma checks and pressure evidence; no-link relationship findings are repaired through meaningful maintained references rather than suppressed as harmless noise.

## Governance Boundaries

- Do not change an immutable release record merely to make it look current.
- Record new release evidence in its versioned release record, then add it to this ledger when it becomes the maintained baseline.
- Keep work that is complete only on one Host in `doing` or a bounded follow-up until its remaining Host-specific acceptance gate is resolved.
- Treat product-value validation, import, guided modeling, and reviewable write operations as roadmap work; do not claim they are delivered solely because current repository workflow is usable.
