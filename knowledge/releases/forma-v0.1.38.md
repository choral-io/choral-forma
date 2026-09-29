---
schemaVersion: 1
kind: release
title: "Forma v0.1.38"
summary: "Interactive temporal views across WebApp and VS Code, reliable native preview enhancements, batch View rendering, and dependency updates."
scope: project
type: release
status: released
version: "v0.1.38"
date: 2026-09-29
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - calendar
    - gantt
    - vscode
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
sources:
    - "planning/temporal-view-release-plan"
    - "architecture/editor-extension-adapter-contract"
---

# Forma v0.1.38

## Scope

Coordinated Public Preview release following [[releases/forma-v0.1.37]]. Core, CLI, shared projections, WebApp, VS Code, and the aligned Zed package use version 0.1.38. The immutable source candidate is `ebd993237ec45b7fef467136f78e74b823d52942`.

## Included Changes

- Share interactive Calendar and Gantt projections across the WebApp and VS Code; update the VS Code view icons and view contracts.
- Fix temporal event navigation and Calendar month jumps in VS Code native Markdown previews. Keep metadata folding synchronous and make Forma-managed enhancements consistent across preview entry paths.
- Reconcile previews as configuration scope changes, discard stale asynchronous results, coalesce unchanged or repeated refreshes, and defer interactive module initialization until matching content is present.
- Add batch rendering for all discovered Views with `forma view render --all`.
- Refresh Wrangler and VS Code language-client dependencies and add the shared temporal package dependencies.

## Validation

The exact source candidate passed `mise run version:check -- v0.1.38` and `CI=true mise run check`: 526 JavaScript tests across 81 files, 532 Rust tests, repository scripts, TypeScript, lint, formatting, builds, and Zed WASI checking. Forma content checks passed, and post-release workspace health and record-link checks passed after this record was linked from the delivery ledger.

The VS Code extension passed its host tests and packaged-VSIX installation/activation smoke test on the minimum supported editor, VS Code 1.123.2. Local trusted integration also covered the minimum and stable editors; restricted-mode coverage passed. The extension declares engine `^1.123.2`.

Exact-source [main CI run 36543180732](https://github.com/choral-io/choral-forma/actions/runs/36543180732) passed for `ebd993237ec45b7fef467136f78e74b823d52942`.

## Publication Evidence

- [Release workflow 36545754425](https://github.com/choral-io/choral-forma/actions/runs/36545754425) passed candidate validation, all five CLI platform builds, VSIX host tests and packaging, source-bound assembly, protected promotion, published-release verification, and Marketplace publication.
- Annotated tag `v0.1.38` is tag object `36942a2b3a7e6afb3dc95da0ca610b626437e9be`, peeling to the exact source candidate above.
- [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.1.38) was published at `2026-09-29T09:12:52Z` with `draft=false`, `prerelease=false`, and all 22 expected assets.
- `mise run release:verify -- v0.1.38` passed on macOS arm64. All 11 payloads matched their published SHA-256 files. The downloaded native CLI and a fresh installation through the production managed-install code both executed as `forma 0.1.38`; temporary verification files were cleaned.
- Native `forma-macos-arm64` SHA-256: `8aeed13fa28bb54f1b10852a311577740631e4c4f25345507517d10036d7b7df`.
- Published VSIX: `choral-io.forma@0.1.38`, engine `^1.123.2`, 316,073 bytes, SHA-256 `5b811daf02795a91cb7419a8acdcd8bb8cdc26465c16465119099fcf0695d93c`. The GitHub asset digest and Marketplace `Microsoft.VisualStudio.Services.VsixSha256` readback match.
- Marketplace readback through `vsce show choral-io.forma --json` found version `0.1.38`, last updated `2026-09-29T09:23:02.943Z`.

## Release Notes

> Forma 0.1.38 brings interactive Calendar and Gantt views to VS Code, improves native Markdown preview navigation and enhancement updates, and adds batch rendering for configured Views.

## Known Boundaries

Safari, physical mobile devices, real screen-reader announcements, Remote SSH, Dev Container, WSL, signing, notarization, and Zed Registry publication were not established by this release verification.

## Executed Rollout

1. Completed local version, repository, content, and packaged-editor gates; pushed the candidate and confirmed main CI for the exact source SHA.
2. Dispatched the protected Release workflow with `0.1.38`; GitHub Release promotion, published-asset verification, and Marketplace publication completed successfully.
3. Ran `mise run release:verify -- v0.1.38` and recorded the published assets, hashes, CLI/VSIX identity, and managed-install result.
4. Read back the Marketplace version and confirmed its VSIX hash matches the published GitHub asset.
5. Added this record to the delivery ledger as post-release evidence; the release-record and content checks passed.

## Rollback Plan

Before publication, remediate the candidate and repeat the exact-source gates. After publication, preserve the immutable tag and assets and publish a higher coordinated version for corrections. Use the official installer as the recovery path.
