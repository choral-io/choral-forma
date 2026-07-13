---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.16
summary: Performance-focused internal alpha with scoped discovery, bounded editor work, and a compact lazy Explorer.
scope: project
type: release
status: candidate
version: v0.1.0-alpha.16
date: 2026-07-13
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - vscode
    - performance
    - validation
relatedTestCases:
    - "test-cases/forma-starter-kit"
---

# Forma v0.1.0-alpha.16

## Purpose

Publish the performance and workspace-scope improvements completed after [[releases/forma-v0.1.0-alpha.15]] as an immutable internal prerelease. CLI, Core, RPC, WebApp, and VS Code extension artifacts use the same version because the extension now consumes new compact Explorer operations.

## Scope

- Discover Forma from the selected root `.forma.md` and recompute controlled file scope when imports or configured includes change.
- Avoid scanning and watching unrelated workspace Markdown outside configured content scope.
- Reuse one document analysis result for Preview links and diagnostics instead of resolving every link in a separate CLI process.
- Bound Forma CLI concurrency to two, deduplicate identical work, cancel stale generations, and coalesce refresh bursts.
- Reuse an already loaded workspace configuration across Core discovery and operation projections.
- Add `workspace explorer` and paginated `workspace explorer-entries` CLI/RPC operations.
- Load taxonomy and View summaries initially, then fetch term entries lazily in pages of 100 with a hard maximum of 500.
- Keep the complete dashboard operation available for consumers that need the full projection.
- Add repeatable 1,000-entry and 5,000-entry performance benchmarks and aligned release-version automation.

## Release Gates

1. `CI=true mise run check` passes locally after the version update.
2. `mise run version:check -- v0.1.0-alpha.16` passes.
3. Forma config, content checks, and workspace health pass.
4. The clean full performance baseline remains within the documented latency, output, and peak RSS budgets.
5. Tag CI passes version validation, five CLI builds, Extension Host tests, VSIX packaging, and packaged-artifact smoke validation.
6. GitHub Release publishes five CLI archives, `forma-0.1.0-alpha.16.vsix`, and a checksum for every payload.
7. Downloaded release payloads pass checksum, binary-version, and VSIX identity verification.

## Known Boundaries

- Graph rendering remains a separate focused project.
- Semantic analysis and View projections refresh from saved Markdown.
- Explorer output is compact and paginated, but each short-lived CLI operation still reconstructs its in-memory workspace analysis.
- Local workspaces are the release gate. Remote environments remain best-effort until separately measured.

## Validation

- Dependency lockfiles installed successfully under the repository supply-chain policy.
- Forma config inspection and workspace health passed before release preparation.
- Performance Iterations 0 through 4 and Milestone A are recorded in [[planning/forma-performance-optimization-plan]].
- Pre-tag local validation, tag CI, published artifact verification, and post-release performance measurements will be appended after completion.

## Release Notes

> Forma `v0.1.0-alpha.16` focuses on keeping editor interaction predictable as a workspace grows. It scopes discovery to configured content, removes per-link process fan-out, bounds and deduplicates extension work, reuses loaded Core configuration, and replaces the VS Code Explorer's full dashboard payload with compact summaries and paginated lazy entries.

## Rollback Plan

Do not move or overwrite the Alpha 16 tag. If internal testing finds a release blocker, stop distributing Alpha 16, record the failure, and publish a new version after the correction is verified.

## Post-Release Follow-Up

- Reassess performance from the exact Alpha 16 release commit and record the comparison with the Alpha 15-era baseline.
- Measure VS Code Remote separately before changing the current short-lived CLI transport.
