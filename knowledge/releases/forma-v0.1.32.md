---
schemaVersion: 1
kind: release
title: "Forma v0.1.32"
summary: "Deterministic Graph initial-layout stability and a coordinated dependency refresh."
scope: project
type: release
status: released
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

The exact `main` candidate passed the local release gates before the protected Release workflow was dispatched.

- **Local candidate gates:** `mise run version:check -- v0.1.32`, `mise run release:record-check -- v0.1.32`, Forma `check --json`, and workspace health passed with zero errors and zero warnings. `CI=true mise run check` passed with 67 pnpm test files/404 tests, a green Rust workspace, Zed WASM, TypeScript, ESLint, Prettier, WebApp, and VS Code builds.
- **VSIX:** `forma-0.1.32.vsix` packaged 57 files and passed isolated installation, activation, and LSP smoke validation as `choral-io.forma@0.1.32`; the disposable local artifact was removed after verification. The protected workflow rebuilt and verified the source-bound asset used for publication.

## Published Evidence

- **Candidate:** `2b20e1f07ca457765bcbecac0ebeac9fa02a844e`.
- **Exact main CI:** [run 32553039600](https://github.com/choral-io/choral-forma/actions/runs/32553039600) passed the repository checks, installers, Knowledge, WebApp, VS Code, five-target CLI release builds, Linux GNU compatibility, and deployment jobs for the exact candidate.
- **Release workflow:** [run 32553525121](https://github.com/choral-io/choral-forma/actions/runs/32553525121) validated the exact candidate, assembled and promoted the source-bound 22-asset release, verified the published payloads, and published the matching Marketplace VSIX.
- **GitHub Release:** [Forma v0.1.32](https://github.com/choral-io/choral-forma/releases/tag/v0.1.32) is published as the coordinated Public Preview release. The annotated `v0.1.32` tag resolves to the candidate commit.
- **Independent verification:** `mise run release:verify -- v0.1.32` passed for 22 assets and 11 payloads. The native macOS Arm64 CLI reported `forma 0.1.32` with SHA-256 `34d23889ec396f69e6fb31579b064a1d21239b69e8810ef49d7da32be6c839ca`; the VSIX reported `choral-io.forma@0.1.32`, engine `^1.110.0`, and SHA-256 `80c6bbab28a71b521b013200e9c24fc6ab705c4754d5bdc54cbb502001a7490c`.
- **Managed installation:** the production editor-extension installation implementation downloaded, checksum-verified, installed, and executed the published `forma-macos-arm64` payload as `forma 0.1.32`.
- **Marketplace:** the protected Marketplace job published `choral-io.forma v0.1.32`; the public listing is [Forma on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=choral-io.forma).

## Rollout Plan

1. Completed the aligned candidate commit and local release gates.
2. Pushed the candidate and passed exact-source main CI before tag creation.
3. Promoted the source-bound candidate through the protected Release workflow and verified the published GitHub assets.
4. Published the matching VS Code Marketplace extension and completed independent published-release verification.

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
- Track any correction through a higher coordinated version; do not move or overwrite the immutable `v0.1.32` tag or published assets.
