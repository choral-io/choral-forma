---
schemaVersion: 1
kind: release
title: "Forma v0.1.32"
summary: "Deterministic Graph initial-layout stability and a coordinated dependency refresh."
scope: project
type: release
status: planned
version: "v0.1.32"
date: 2026-08-22
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - graph
    - performance
    - dependencies
    - vscode
    - webapp
relatedTasks:
    - "tasks/validate-shared-graph-view-cross-host-parity"
    - "tasks/implement-shared-graph-view-runtime"
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.32

## Scope

Prepare the next coordinated Public Preview patch after [[releases/forma-v0.1.31]]. This cutline addresses the visible multi-step layout movement that remained when a Graph first opened, while retaining one shared Graph runtime and explicit WebApp and VS Code execution policies. It also carries the already approved dependency refresh and the repository's own Workspace Graph ownership-edge cleanup.

## Included Changes

- Bound Graph layout work by Host policy and publish settled coordinates atomically, keeping the canvas hidden and accessible as busy until the initial layout is ready instead of exposing intermediate positions or a second camera animation.
- Preserve surviving node positions across projection refreshes, seed only new nodes near known neighbors, and keep reset, reduced-motion, and disposal behavior deterministic across WebApp and VS Code.
- Extend the refresh-movement gate and cross-Host validation record with initial-load stability evidence for approximately 500- and 5,000-node fixtures and the current Workspace Graph.
- Refresh the compatible Cargo and pnpm dependency sets and regenerate the bundled link-icon asset without changing the files-first Markdown and schema source-of-truth model.
- Narrow Forma's own Workspace Graph ownership edges so personal profile documents do not create broad project-wide relationships in the repository dogfooding workspace.

## Validation Plan

1. `mise run version:check -- v0.1.32`, `mise run release:record-check -- v0.1.32`, and `CI=true mise run check` pass from the exact candidate.
2. Forma configuration, content, and workspace-health checks pass with zero errors and zero warnings.
3. The coordinated `forma-0.1.32.vsix` packages and passes isolated integration and smoke gates with a matching `forma 0.1.32` binary.
4. The WebApp and packaged VS Code Graph movement gates pass for the approximately 500- and 5,000-node fixtures, including initial render, refresh stability, reset responsiveness, reduced motion, and disposal.
5. Main CI passes for the exact candidate commit before an annotated tag is created.
6. The protected Release workflow builds the expected cross-platform archives, standalone binaries, VSIX, and sibling SHA-256 assets from the exact source.
7. After publication, `mise run release:verify -- v0.1.32` verifies the published asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Preparation Evidence

This record is a release candidate plan, not publication evidence. The current preparation must record the exact candidate commit and local gate results here before any push or tag decision. Main CI, the protected Release workflow, published assets, Marketplace state, and `release:verify` remain pending until their respective authorized steps are executed.

## Rollout Plan

1. Complete and commit the aligned `0.1.32` candidate and its local validation evidence.
2. Push the exact candidate and require green main CI before any tag decision.
3. Create and push the annotated `v0.1.32` tag only after explicit maintainer approval and exact-source CI success.
4. Observe the protected Release workflow and run the executable published-release verification gate.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no migration.
- The release remains a Public Preview and preserves the coordinated CLI, VS Code, and Zed version contract.
- Remote SSH, Dev Container, WSL, code signing, notarization, Zed Registry publication, and non-native in-place replacement paths remain bounded acceptance areas unless exact release evidence closes them.

## Release Notes

> Forma `v0.1.32` removes the visible initial Graph layout jitter while preserving stable refreshes across WebApp and VS Code, and refreshes the coordinated dependency toolchain.

## Rollback Plan

Do not move or overwrite a published tag or asset. Before publication, return a failed candidate to remediation. After publication, use the official installer as the recovery path and publish a higher coordinated version for any correction.

## Post-Release Follow-Up

- Keep the remaining Host-specific and distribution-specific acceptance boundaries explicit in the next release review.
- Continue separating product-value validation from renderer hardening; the next adoption slice remains guided knowledge modeling and external value validation.
