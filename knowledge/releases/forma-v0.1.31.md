---
schemaVersion: 1
kind: release
title: "Forma v0.1.31"
summary: "Cross-Host Graph lifecycle hardening, Linux GNU release compatibility, and a coordinated dependency refresh."
scope: project
type: release
status: planned
version: "v0.1.31"
date: 2026-08-16
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - graph
    - compatibility
    - dependencies
    - vscode
    - zed
    - cli
relatedTasks:
    - "tasks/validate-shared-graph-view-cross-host-parity"
    - "tasks/integrate-shared-graph-view-vscode-preview"
    - "tasks/migrate-webapp-to-shared-graph-view"
    - "tasks/stabilize-linux-gnu-prebuilt-compatibility"
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.31

## Scope

Publish the coordinated Public Preview patch after [[releases/forma-v0.1.30]]. This cutline completes the shared Graph View cross-Host hardening, makes Linux GNU and portable installer compatibility gates explicit, and refreshes the compatible pnpm and Cargo dependency sets without changing the Markdown-and-schema source-of-truth model.

## Included Changes

- Color Graph nodes from configured frontmatter fields and preserve Graph positions across refreshes while releasing Graph canvas backing stores, WebGL contexts, and renderer resources deterministically in WebApp and VS Code.
- Complete cross-Host Graph parity evidence and keep VS Code workspace output budgets, fixture resolution, and lifecycle checks aligned with the shared renderer.
- Stabilize Linux GNU release artifacts against the supported glibc baseline and add the corresponding packaging compatibility gate.
- Make Unix installer checksum verification portable across available checksum tools and keep the deployment contract pinned to the refreshed Wrangler version.
- Refresh compatible pnpm and Cargo dependencies, regenerate the bundled Lucide link-icon asset, and synchronize the release-version documentation and manifests at `0.1.31`.

## Validation

Required candidate evidence:

1. `mise run version:check -- v0.1.31`, `mise run release:record-check -- v0.1.31`, and `CI=true mise run check` pass from the exact candidate.
2. Forma `check` and workspace health pass with zero errors and zero warnings.
3. The coordinated `forma-0.1.31.vsix` packages and passes isolated integration and smoke gates with a matching `forma 0.1.31` binary.
4. Unix and Windows installer tests, including portable checksum-tool handling and the Linux GNU compatibility gate, pass for the candidate.
5. Main CI passes for the exact candidate commit before the annotated tag is created.
6. The protected Release workflow builds the expected cross-platform archives, standalone binaries, VSIX, and sibling SHA-256 assets from the exact source.
7. After publication, `mise run release:verify -- v0.1.31` verifies the published asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Rollout Plan

1. Complete and commit the aligned `0.1.31` candidate after the local release gates pass.
2. Push the candidate only after explicit maintainer approval and require green main CI for that exact commit.
3. Create and push the annotated `v0.1.31` tag only after exact-source main CI succeeds and explicit tag approval is given.
4. Observe the protected Release workflow and run independent published-release verification before recording immutable publication evidence.
5. Keep this record planned until the published GitHub assets and any editor distribution artifacts have been independently verified.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no migration.
- The release remains a Public Preview and preserves the coordinated CLI, VS Code, and Zed version contract.
- Remote SSH, Dev Container, WSL, code signing, notarization, Zed Registry publication, and non-native in-place replacement paths remain bounded acceptance areas unless exact release evidence closes them.

## Release Notes

> Forma `v0.1.31` hardens the shared Graph experience across hosts, makes Linux GNU and portable installer compatibility explicit, and refreshes the coordinated dependency toolchain.

## Rollback Plan

Do not move or overwrite a published tag or asset. Before publication, return a failed candidate to remediation. After publication, use the official installer as the recovery path and publish a higher coordinated version for any correction.

## Post-Release Follow-Up

- Record exact main-CI, tag, published-asset, managed-install, and editor-distribution evidence before changing this record to `released`.
- Keep remaining Host-specific and distribution-specific acceptance boundaries explicit in the next release review.
