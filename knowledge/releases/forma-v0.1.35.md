---
schemaVersion: 1
kind: release
title: "Forma v0.1.35"
summary: "Guideline globs, predictable path matching, WebApp loading and route restructuring, and a rolling VS Code compatibility window."
scope: project
type: release
status: planned
version: "v0.1.35"
date: 2026-09-05
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - configuration
    - webapp
    - vscode
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.35

## Scope

Publish the next coordinated Public Preview patch after [[releases/forma-v0.1.34]]. The cutline includes guideline glob declarations, explicit directory-boundary matching, WebApp dashboard/router and React Compiler improvements, dependency updates, and the VS Code 90-day compatibility policy.

## Included Changes

- Expand workspace and content-group guideline declarations from exact Markdown paths or globs, with deterministic ordering, deduplication, authored source diagnostics, and change watching shared by CLI, RPC, and skill projections.
- Make `*` and `?` stay within a path component and use `**` for recursive matching across imports, content/taxonomy selection, guidelines, and View filters.
- Restructure WebApp dashboard data and route boundaries, enable React Compiler, and defer Markdown math loading.
- Adopt a monthly-reviewed 90-day VS Code compatibility window. The minimum is 1.123.2; declaration types remain on 1.120 because no 1.123 declaration series is published.
- Reuse an exact matching installed stable VS Code for isolated tests, retain the minimum-version test cache, and preserve explicit test-version overrides.
- Refresh pnpm/Cargo dependencies and align generated Lucide assets and deployment assertions.
- Streamline repository Agent/guideline routing and configured team handoffs without presenting repository workflow concepts as product built-ins.

## Validation

The following are release gates, not claims of publication:

1. Align the coordinated versions and pass `mise run version:check -- v0.1.35` and `mise run release:record-check -- v0.1.35`.
2. Pass `CI=true mise run check`, Forma content checks, and workspace health on the final candidate.
3. Package `forma-0.1.35.vsix` and verify isolated installation/activation with the matching CLI; verify Extension Host behavior at 1.123.2 and current stable.
4. Push the complete candidate and require successful main CI for its exact SHA, including cross-platform CLI builds and extension gates.
5. Dispatch the protected Release workflow for 0.1.35 from that main commit. Verify the source-bound assets before promotion and Marketplace publication.
6. Run `mise run release:verify -- v0.1.35` after publication and record immutable evidence separately.

## Rollout Plan

1. Commit and push the aligned release candidate after local gates and independent review.
2. Wait for exact-source main CI; remediate any failure before publication.
3. Dispatch `.github/workflows/release.yml` with version `0.1.35`. Its protected promotion job creates the annotated tag and publishes the source-bound candidate.
4. Verify GitHub Release assets and Marketplace publication, then update this record and [[planning/forma-release-and-delivery-ledger]] in a separate evidence commit.

## Migration Or Operations Notes

- Patterns that relied on `*` crossing directory separators must use `**` for that intent. Recheck effective sources and path classification before sharing or exporting content. A directory named `local` and Git ignore rules do not provide runtime privacy.
- Exact guideline paths remain supported. Empty guideline globs produce a warning; invalid globs and invalid exact paths remain errors. Symlink ancestors are not traversed.
- VS Code users below 1.123.2 must update their editor to install this extension release. Existing published extension manifests remain unchanged.
- The release remains a Public Preview. Remote SSH, Dev Container, WSL, signing, notarization, Zed Registry publication, and non-native in-place replacement remain unverified unless the published evidence names a completed test.

## Release Notes

> Forma 0.1.35 adds guideline glob declarations with consistent source diagnostics and watching, improves WebApp data flow and rendering, refreshes dependencies, and adopts a 90-day VS Code compatibility window. Recursive path selection now requires `**`; VS Code 1.123.2 or newer is required.

## Rollback Plan

Before publication, remediate the candidate and repeat its exact-source gates. After publication, preserve the immutable tag and assets and publish a higher coordinated version for corrections. Use the official installer as the recovery path.

## Post-Release Follow-Up

Record candidate SHA, local/main/Release gates, published asset inventory and hashes, CLI and VSIX identities, managed installation, Marketplace evidence, and residual platform limits. Mark this record released only after verification, then update the delivery ledger and run the release-record backlink check.
