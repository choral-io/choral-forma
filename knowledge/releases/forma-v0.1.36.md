---
schemaVersion: 1
kind: release
title: "Forma v0.1.36"
summary: "Guided Modeling foundation, explicit structured Markdown output, skill routing, configuration diagnostics, and toolchain refresh."
scope: project
type: release
status: released
version: "v0.1.36"
date: 2026-09-09
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - guided-modeling
    - configuration
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.36

## Scope

Publish the next coordinated Public Preview patch after [[releases/forma-v0.1.35]]. The cutline includes the first reviewed Guided Modeling slice, explicit structured Markdown output, discoverable Skill routing, configuration-error provenance, and the coordinated dependency and Vitest 5 baseline refresh.

## Included Changes

- Add the `forma model guide`, `forma model prepare`, and `forma model apply` Guided Modeling flow for an initialized empty corpus, one content group, `Text` and `Date` fields, and a table view.
- Make `structuredMarkdown` explicit in the model output contract and make the `forma-guided-modeling` Skill discoverable with deterministic routing and ordering.
- Preserve configuration-error provenance so diagnostics identify the authored source and location.
- Refresh dependencies and migrate the Vitest benchmark baseline.

Guided Modeling remains intentionally bounded: there is no modeling RPC, existing-content inventory/import, GUI, or complete natural-language inference. The frontmatter closing marker must begin in the first column for compatibility. `gm1` is an unpublished development intermediate and receives no compatibility implementation. The original design Task is not automatically marked complete by this release.

## Validation

### Candidate And Publication

- Candidate commit: `51a0cd312c5c9014ae5e1a46ca4d65c0140f749c`.
- Local gates passed: `mise run version:check -- v0.1.36`, `CI=true mise run check` (43.18 seconds), Forma `check` and workspace health (0 errors, 0 warnings), VSIX packaging, and disposable VSIX installation/activation/LSP smoke.
- Exact-source [main CI run 34374131215](https://github.com/choral-io/choral-forma/actions/runs/34374131215) passed all web, knowledge, static-site, Rust, VS Code, installer, deployment, and five-platform CLI jobs.
- [Release workflow 34375558168](https://github.com/choral-io/choral-forma/actions/runs/34375558168) passed exact-candidate validation, five-platform CLI and VSIX builds, source-bound assembly, protected promotion, published verification, and protected Marketplace publication.
- Annotated tag object `d7fe6e860e58efc1e8276754f0ee05296d4fd438` for `v0.1.36` resolves to the exact candidate commit above.
- [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.1.36) was published at `2026-09-09T16:32:21Z`, with `draft=false` and `prerelease=false`. All 22 expected assets are present.

### Published Assets And Installation

`mise run release:verify -- v0.1.36` passed on macOS ARM64 after publication:

- Exact asset inventory: 22 assets; all 11 payloads match their sibling SHA-256 files.
- Native standalone CLI: `forma-macos-arm64`, reporting `forma 0.1.36`; SHA-256 `430859231b321918588e37343c036035ea8400e3c8e76fba039bd75b0092c5c3`.
- Published VSIX: `choral-io.forma@0.1.36`, display name `Forma by Choral`, engine `^1.123.2`; SHA-256 `8bfa5d3ad15768ac0f7c93d2ba47cdc8d04d7560975312154c161503c3f02fd9`.
- The production managed-install implementation downloaded, verified, installed, and executed the published `forma-macos-arm64` CLI as `forma 0.1.36` in disposable storage. Verification downloads and managed storage were cleaned.
- Marketplace readback via `vsce show choral-io.forma --json` found version `0.1.36` (last updated `2026-09-09T16:34:54.320Z`); its `Microsoft.VisualStudio.Services.VsixSha256` exactly matches the published VSIX hash above.

### Editor Runtime And Remaining Boundaries

Local macOS ARM64 and Release CI packaged-VSIX smoke tests passed with the matching CLI. Release CI built and executed the native CLI jobs for Linux x64/ARM64, macOS x64/ARM64, and Windows x64. Remote SSH, Dev Container, WSL, signing, notarization, Zed Registry publication, and non-native in-place replacement remain unverified.

## Rollout Plan

1. Aligned the coordinated version and release content, ran the exact-candidate local gates, and committed and pushed candidate `51a0cd3`.
2. Confirmed main CI for the exact candidate SHA, dispatched `.github/workflows/release.yml` with version `0.1.36`, and approved its protected `release-production` and `vscode-marketplace-publish` environments.
3. Verified the published assets and managed installation, then recorded closure evidence in this record and the delivery ledger in a separate post-release commit.

## Migration Or Operations Notes

- The frontmatter closing marker must begin in the first column; indented closing markers are not compatible with this release.
- Guided Modeling currently initializes only an empty corpus with one content group, `Text` and `Date` fields, and a table view. Existing-content inventory/import, modeling RPC, GUI, and complete natural-language inference remain future work.
- `gm1` is a development intermediate and is not a published compatibility format.
- The release remains a Public Preview.

## Release Notes

> Forma 0.1.36 adds the first bounded Guided Modeling workflow, explicit structured Markdown output, discoverable Skill routing, configuration diagnostics, and a refreshed Vitest 5 toolchain baseline.

## Rollback Plan

Before publication, remediate the candidate and repeat its exact-source gates. After publication, preserve the immutable tag and assets and publish a higher coordinated version for corrections. Use the official installer as the recovery path.

## Post-Release Follow-Up

Publication and independent verification are complete. The separate post-release evidence commit updates this record and the delivery ledger; the immutable release tag remains on the candidate commit. Related design work remains bounded by the scope above and was not automatically marked complete.

The post-release evidence commit is `daf126a75cadc69b499b0e43422d8a9375177cf5`; its [CI run 34377954966](https://github.com/choral-io/choral-forma/actions/runs/34377954966) passed. A subsequent documentation correction clarifies the command names and distinguishes field types from the table view. Published tags and assets, including the changelog embedded in the v0.1.36 VSIX, remain unchanged.
