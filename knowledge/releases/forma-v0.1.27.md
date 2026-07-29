---
schemaVersion: 1
kind: release
title: "Forma v0.1.27"
summary: "Corrective Public Preview release for the v0.1.26 feature cutline and cross-platform publication."
scope: project
type: release
status: planned
version: "v0.1.27"
date: 2026-07-29
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - corrective
    - cross-platform
    - workflow
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.27

## Scope

Publish the complete [[releases/forma-v0.1.26]] feature cutline from a new immutable tag after correcting the Windows release-build failure. The candidate retains the static publishing, resolved workspace operations, runtime performance, Agent Skill, CLI, WebApp, VS Code, Zed, and compatible dependency changes prepared for `v0.1.26`.

## Included Changes

- Replace the POSIX-only `VITE_FORMA_WORKSPACE_CLIENT=static` package-script assignment with the cross-platform Vite `static` mode.
- Resolve the static or RPC workspace client from Vite's explicit build mode without adding a shell compatibility dependency.
- Add a release regression test that rejects inline POSIX environment assignments in the WebApp build run by the cross-platform asset matrix.
- Carry forward the complete `v0.1.26` Public Preview scope because that tag failed before GitHub Release or Marketplace publication.

## Validation

1. The focused release regression test and both WebApp build modes pass.
2. `mise run version:check -- v0.1.27` and `CI=true mise run check` pass from the exact candidate.
3. Forma content checks and workspace health pass.
4. The matching `forma-0.1.27.vsix` packages and passes its isolated installation and activation smoke test.
5. The complete candidate is pushed and main CI passes for its exact commit before tagging.
6. The tag-triggered Release workflow builds all supported CLI assets and the VSIX, including the Windows runner that failed for `v0.1.26`.
7. `mise run release:verify -- v0.1.27` verifies the published asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Rollout Plan

- Create an annotated `v0.1.27` tag only after exact-source local and main gates pass.
- Let the protected Release workflow publish GitHub assets and the verified VSIX to Marketplace.
- Keep the failed `v0.1.26` tag immutable and do not create a release from it.

## Migration Or Operations Notes

- Existing Forma workspace content does not require migration.
- Consumers who did not receive `v0.1.26` should upgrade directly from `v0.1.25` to `v0.1.27`.
- Main-branch static-site deployment remains independent from the versioned CLI and editor-extension release.

## Release Notes

> Forma `v0.1.27` publishes the full static-site, runtime-performance, resolved-workspace, and Agent Skill update through a corrected cross-platform release build.

## Rollback Plan

Do not move or overwrite `v0.1.26`, `v0.1.27`, Marketplace versions, or verified release assets. If publication or post-release verification finds another blocker, publish a higher coordinated version after remediation.

## Post-Release Follow-Up

- Add this released record to [[planning/forma-release-and-delivery-ledger]], then run `mise run release:record-check -- v0.1.27` before committing the post-release evidence.
- Continue the planned WebApp code-splitting work for the largest generated chunks.
