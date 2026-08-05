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
    - "releases/forma-v0.1.26"
    - "releases/forma-v0.1.27"
    - "releases/forma-v0.1.28"
    - "releases/forma-v0.1.29"
    - "releases/forma-v0.1.30"
    - "planning/release-artifact-promotion-pipeline-redesign"
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

| Version         | Record                             | Position                                            |
| --------------- | ---------------------------------- | --------------------------------------------------- |
| v0.1.0-alpha.13 | [[releases/forma-v0.1.0-alpha.13]] | First editor-extension alpha cutline.               |
| v0.1.0-alpha.14 | [[releases/forma-v0.1.0-alpha.14]] | Historical alpha release evidence.                  |
| v0.1.0-alpha.15 | [[releases/forma-v0.1.0-alpha.15]] | Historical editor-experience release evidence.      |
| v0.1.0-alpha.16 | [[releases/forma-v0.1.0-alpha.16]] | Historical performance release evidence.            |
| v0.1.0-alpha.17 | [[releases/forma-v0.1.0-alpha.17]] | Historical release-verification evidence.           |
| v0.1.0-alpha.18 | [[releases/forma-v0.1.0-alpha.18]] | Historical LSP navigation release evidence.         |
| v0.1.0-alpha.19 | [[releases/forma-v0.1.0-alpha.19]] | Historical graph and editor validation evidence.    |
| v0.1.0-alpha.20 | [[releases/forma-v0.1.0-alpha.20]] | Shared Graph milestone.                             |
| v0.1.0-alpha.21 | [[releases/forma-v0.1.0-alpha.21]] | Internal branding and Graph-parity release.         |
| v0.1.22         | [[releases/forma-v0.1.22]]         | First Marketplace-ready Public Preview candidate.   |
| v0.1.23         | [[releases/forma-v0.1.23]]         | Previous released Public Preview record.            |
| v0.1.24         | [[releases/forma-v0.1.24]]         | Previous released Public Preview record.            |
| v0.1.25         | [[releases/forma-v0.1.25]]         | Released View navigation and Marketplace milestone. |
| v0.1.26         | [[releases/forma-v0.1.26]]         | Failed before publication in the Windows asset job. |
| v0.1.27         | [[releases/forma-v0.1.27]]         | Failed before publication in later release gates.   |
| v0.1.28         | [[releases/forma-v0.1.28]]         | Released corrective Public Preview milestone.       |
| v0.1.29         | [[releases/forma-v0.1.29]]         | Released managed CLI self-update milestone.         |
| v0.1.30         | [[releases/forma-v0.1.30]]         | Planned receipt-free update and editor milestone.   |

## Current Delivery Cutline

- **Current released baseline:** [[releases/forma-v0.1.29]]. Its record contains the exact candidate, cross-platform CI, GitHub Release, Marketplace publication, published-asset, managed self-update, recovery, and known-boundary evidence.
- **Active release candidate:** [[releases/forma-v0.1.30]] coordinates receipt-free self-update transactions, Core-owned editor navigation intelligence, and executable FDE workspace examples. It remains planned until exact-source local and main gates pass and publication is separately approved.
- **Failed publication attempt:** [[releases/forma-v0.1.26]] records the immutable tag whose Windows asset build failed before GitHub Release or Marketplace publication.
- **Second failed publication attempt:** [[releases/forma-v0.1.27]] records the immutable tag that fixed the Windows WebApp shell issue but exposed CRLF parsing and shared-runner performance-gate weaknesses before publication.
- **Active validation:** [[tasks/validate-shared-graph-view-cross-host-parity]] remains the active cross-Host Graph evidence boundary.
- **Active delivery:** [[tasks/optimize-sticky-headers-in-view-rendering]] has completed the WebApp Table and Kanban slices; the remaining scope is the VS Code native-preview evaluation.
- **Next product-value slices:** [[tasks/design-guided-knowledge-modeling-flow]] and [[tasks/define-external-product-value-validation]] are ready. Guided modeling remains the first adoption-path design; external validation defines the parallel comparative evidence gate and starts from the authorized case corpus.
- **Architecture dependency:** [[planning/taxonomy-term-presentation-and-graph-color-execution-plan]] keeps taxonomy-neutral presentation, membership, and cross-Host validation boundaries explicit.
- **Release workflow hardening:** [[planning/release-artifact-promotion-pipeline-redesign]] remains the design basis for source-bound promotion. The v0.1.29 recovery hardened draft reconciliation; cross-workflow reuse of the already verified main-CI artifacts remains a bounded efficiency follow-up.

## Workflow-Readiness Review

[[metrics/knowledge-workflow-replacement-readiness]] is reviewed after a release or material workspace-workflow change. A ready judgment requires current successful Forma checks and pressure evidence; no-link relationship findings are repaired through meaningful maintained references rather than suppressed as harmless noise.

## Governance Boundaries

- Do not change an immutable release record merely to make it look current.
- Record new release evidence in its versioned release record, then add it to this ledger when it becomes the maintained baseline.
- Keep work that is complete only on one Host in `doing` or a bounded follow-up until its remaining Host-specific acceptance gate is resolved.
- Treat product-value validation, import, guided modeling, and reviewable write operations as roadmap work; do not claim they are delivered solely because current repository workflow is usable.
