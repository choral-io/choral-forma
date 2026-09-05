---
schemaVersion: 1
kind: release
title: "Forma v0.1.35"
summary: "Guideline globs, predictable path matching, WebApp loading and route restructuring, and a rolling VS Code compatibility window."
scope: project
type: release
status: released
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

### Candidate And Publication

- Candidate commit: `5a5f137b367cc0e289aa9b66be88b527fff90108`.
- Local gates passed: `mise run version:check -- v0.1.35`, `mise run release:record-check -- v0.1.35`, `CI=true mise run check`, Forma content checks, and workspace health (zero errors and warnings).
- Independent candidate review completed; its release-record wording and ledger-table findings were resolved before the final local gate and candidate commit.
- Exact-source [main CI run 33964428095](https://github.com/choral-io/choral-forma/actions/runs/33964428095) passed, including Rust, Web, static site, Knowledge, Unix/Windows installers, VS Code, and five-platform CLI verification.
- [Release workflow 33965357200](https://github.com/choral-io/choral-forma/actions/runs/33965357200) passed: exact-source validation, five-platform CLI and VSIX builds, source-bound candidate assembly, protected promotion, published verification, and protected Marketplace publication.
- Annotated tag object `7933bea1af4a20b5876ce5a2a97de072379f2080` for `v0.1.35` resolves to the exact candidate commit above.
- [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.1.35), ID `383239447`, was published at `2026-09-05T12:24:57Z`, with `draft=false` and `prerelease=false`. All 22 expected assets are uploaded. The public notes were read back after adding glob migration and minimum-editor guidance.

### Published Assets And Installation

`mise run release:verify -- v0.1.35` passed on macOS ARM64 after publication:

- Exact asset inventory: 22 assets; all 11 payloads match their sibling SHA-256 files.
- Native standalone CLI: `forma-macos-arm64`, reporting `forma 0.1.35`; SHA-256 `f1a9cc7b076e34c39e3cd4f1682fa3615a878455423d0870a6aea6aa2465ce4a`.
- Published VSIX: `choral-io.forma@0.1.35`, display name `Forma by Choral`, engine `^1.123.2`; SHA-256 `12d463652f3118244736afa89bd0f958143975e976aa632e96317833e1edbfe3`.
- The production managed-install implementation downloaded, verified, installed, and executed the published `forma-macos-arm64` CLI as `forma 0.1.35` in disposable storage. Verification downloads and managed storage were cleaned.
- [Marketplace](https://marketplace.visualstudio.com/items?itemName=choral-io.forma) publication succeeded in job `101306111720`. Independent `vsce show choral-io.forma --json` readback found version `0.1.35` (last updated `2026-09-05T12:31:55.690Z`); its `Microsoft.VisualStudio.Services.VsixSha256` exactly matches the published VSIX hash above.

### Editor Runtime And Remaining Boundaries

- Local macOS ARM64 and Release CI Linux x64 Extension Host tests passed at minimum VS Code `1.123.2` and stable `1.136.1` (two trusted tests at each version), plus the minimum-version untrusted-workspace test.
- Local and Release CI packaged-VSIX smoke tests verified isolated installation, activation, and LSP behavior for `choral-io.forma@0.1.35` with the matching CLI.
- At release validation time, the local minimum-version download was retained under the ignored extension test cache. Stable local tests reused the installed VS Code `1.136.1` with isolated test state; obsolete downloaded editor versions were removed.
- Published-download native execution and managed installation were verified on macOS ARM64. Other target binaries have cross-platform CI/build evidence, not an additional local execution claim from this verifier.
- Intermediate VS Code versions, Remote SSH, Dev Container, WSL, signing, notarization, Zed Registry publication, and non-native in-place replacement remain unverified. No related task status was changed solely because this release shipped.

## Rollout Plan

1. Committed and pushed the aligned candidate after local gates and independent review.
2. Confirmed successful main CI for the exact candidate SHA.
3. Dispatched `.github/workflows/release.yml` with version `0.1.35`; its protected promotion job created the annotated tag and published the source-bound candidate.
4. Verified GitHub Release assets and Marketplace publication, then prepared this record and [[planning/forma-release-and-delivery-ledger]] for the separate evidence commit.

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

Publication and independent verification are complete. The separate post-release evidence commit updates this record and the delivery ledger; the immutable release tag remains on the candidate commit. Remaining platform and editor-mode limits are recorded above.
