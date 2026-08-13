---
schemaVersion: 1
kind: task
scope: project
title: Stabilize Linux GNU Prebuilt Compatibility
summary: Build Linux GNU release artifacts against a fixed glibc baseline and fail release packaging before an incompatible ABI ships.
type: task
priority: P1
value: H
module: distribution
effort: S
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers:
    - "members/tiscs"
tags:
    - forma
    - release
    - linux
    - compatibility
    - glibc
blockedBy: []
relatedTo:
    - "architecture/forma-core-technical-direction"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/manage-vscode-forma-cli-lifecycle"
    - "decisions/define-cli-editor-compatibility-window"
severity: high
sprint: ""
reportedBy: "members/tiscs"
affectedArea: Linux GNU release archives and editor-managed CLI binaries
---

# Stabilize Linux GNU Prebuilt Compatibility

## Goal

Make the Linux GNU release contract explicit and reproducible so a supported older Linux host cannot receive a binary that fails at startup because the build runner introduced newer glibc symbol requirements.

## Observed Baseline

The previous Linux x64 candidate was built on Ubuntu 24.04 and required `GLIBC_2.38`/`GLIBC_2.39`. It failed before startup on the Debian 12 validation host, whose glibc is 2.36. The failure was an artifact ABI mismatch rather than an SSH, Remote extension host, or workspace capacity problem.

## In Scope

- Build Linux GNU targets inside the pinned `rust:1.95-bullseye` image, whose Debian 11 base establishes a glibc 2.31 compatibility floor.
- Inspect the resulting ELF version requirements and fail the workflow above `GLIBC_2.31`.
- Smoke-test the packaged managed binary on Debian 11 and Debian 12 containers.
- Reject managed Linux downloads on a detected glibc older than 2.31, while preserving explicit `forma.path` and locally built CLI fallbacks.
- Document the floor and the continuing lack of managed musl/Alpine support.

## Out Of Scope

- Supporting Linux musl/Alpine with a second asset family.
- Rebuilding existing published releases.
- Negotiating CLI/editor protocol capabilities; that design is recorded separately in [[decisions/define-cli-editor-compatibility-window]].
- Claiming support for hosts older than glibc 2.31 without a separate baseline decision.

## Acceptance Criteria

- The reusable release workflow uses one fixed Linux GNU build image for x64 and arm64 and checks the maximum `GLIBC_*` symbol version.
- The gate fails when a fixture or future dependency raises the requirement above `GLIBC_2.31`.
- Both Debian 11 and Debian 12 smoke tests start the packaged binary and print its version.
- VS Code managed installation reports an actionable incompatible-runtime error below glibc 2.31 and does not download an unusable asset.
- README and VS Code installation requirements state the same glibc floor and explicit-path fallback.
- Workflow-contract, managed-cli, Forma check, workspace health, and repository checks pass.

## Result

Implementation is ready for review. CI remains the final external release-gate confirmation for the containerized Linux build and runtime smoke tests.
