---
schemaVersion: 1
kind: release
title: "Forma v0.1.27"
summary: "Corrective Public Preview release for the v0.1.26 feature cutline and cross-platform publication."
scope: project
type: release
status: failed
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

1. The focused release regression test and both WebApp build modes passed.
2. `mise run version:check -- v0.1.27` and `CI=true mise run check` passed from the exact candidate.
3. Forma content checks and workspace health passed.
4. The matching `forma-0.1.27.vsix` packaged and passed its local isolated installation and activation smoke test.
5. Exact-source main [CI run 30440106551](https://github.com/choral-io/choral-forma/actions/runs/30440106551) passed before tagging.
6. The tag-triggered Release workflow verified the corrected Windows WebApp build, but later build and smoke gates failed before publication.

## Failed Publication Attempt

The immutable `v0.1.27` tag points to candidate commit `1776019732b1c38f62704b32e6ed35ee8a998452`. [Release run 30440443182](https://github.com/choral-io/choral-forma/actions/runs/30440443182) confirmed that the cross-platform Vite-mode correction fixed the original Windows WebApp failure, then exposed two later gates:

- The Windows release binary build treated CRLF canonical-document frontmatter as missing because the build-time parser accepted only LF delimiters.
- The packaged VSIX passed build, installation, activation, and functional navigation checks, but a shared-runner scheduling spike caused one 50-sample warm Definition distribution to report `121.968 ms` p95 against the `100 ms` budget.

No GitHub Release, release assets, published-release verification, or Marketplace publication was created for `v0.1.27`. The tag remains unchanged; [[releases/forma-v0.1.28]] carries the full cutline forward with both corrections and a Windows pre-tag CI gate.

## Migration Or Operations Notes

- Existing Forma workspace content does not require migration.
- Consumers should remain on `v0.1.25` until the corrective [[releases/forma-v0.1.28]] release is published.
- Main-branch static-site deployment remains independent from the versioned CLI and editor-extension release.

## Release Notes

> Forma `v0.1.27` publishes the full static-site, runtime-performance, resolved-workspace, and Agent Skill update through a corrected cross-platform release build.

## Rollback Plan

Do not move or overwrite `v0.1.26`, `v0.1.27`, Marketplace versions, or verified release assets. If publication or post-release verification finds another blocker, publish a higher coordinated version after remediation.

## Post-Release Follow-Up

- Preserve this record as failed-publication evidence and link the corrective [[releases/forma-v0.1.28]] result.
- Continue the planned WebApp code-splitting work for the largest generated chunks.
