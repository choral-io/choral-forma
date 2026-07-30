---
schemaVersion: 1
kind: release
title: "Forma v0.1.29"
summary: "Publish explicit checksum-verified self-update for install-script-owned Forma CLI binaries."
scope: project
type: release
status: released
version: "v0.1.29"
date: 2026-07-30
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - cli
    - distribution
    - updates
    - installation
relatedTasks:
    - "tasks/add-owned-forma-cli-self-update"
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.29

## Scope

Publish the coordinated Public Preview update after [[releases/forma-v0.1.28]]. The candidate introduces an explicit, checksum-verified CLI self-update path for installations owned by the official Forma install scripts while keeping mise, WinGet, editor-managed, package-manager, and unknown installations under their existing manager.

## Included Changes

- Add `forma self-update [VERSION]` with latest or exact release selection, `--check`, interactive confirmation, structured JSON output, explicit same-version reinstall, and explicit downgrade acknowledgement.
- Resolve only published `choral-io/choral-forma` GitHub Releases, select the exact supported platform asset, verify its sibling SHA-256 checksum and staged executable version, then delegate only executable replacement to `self-replace`.
- Write an adjacent `forma.install.json` receipt from the official Unix and Windows install scripts; authorize in-place updates only when that receipt identifies the official install-script manager.
- Preserve recovery metadata, backup state, and pending-update reconciliation around executable replacement instead of inferring ownership or success from an installation path.
- Keep normal workspace, server, LSP, editor-managed, and noninteractive operations free of passive release checks or unsolicited update output.
- Default the Windows installer to `%USERPROFILE%\.local\bin`, add that directory to User PATH idempotently, and update the current PowerShell session.
- Exercise the self-update contract in every supported Release build target and refresh the compatible Web dependency baseline.

## Validation

1. `mise run version:check -- v0.1.29` and `CI=true mise run check` pass from the exact candidate.
2. Forma content checks and workspace health pass.
3. Unix and Windows installer regression suites verify receipt creation, explicit install-directory overrides, and PATH behavior.
4. The Release matrix builds and tests the self-update contract for Linux x64 and Arm64, macOS x64 and Arm64, and Windows x64.
5. The matching `forma-0.1.29.vsix` packages and passes its isolated smoke gate with the coordinated CLI version.
6. The complete candidate is pushed and main CI passes for its exact commit before tagging.
7. `mise run release:verify -- v0.1.29` verifies the published asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.
8. A fresh official-script installation of `v0.1.29` writes a valid ownership receipt; `forma self-update --check` reports the published state without mutation; an exact `v0.1.29 --reinstall` exercises the replacement path.

## Rollout Plan

- Create an annotated `v0.1.29` tag only after exact-source local and main gates pass.
- Let the protected Release workflow publish GitHub assets and the verified coordinated VSIX to Marketplace.
- Verify the published release before changing this record to `released` or closing the release ledger update.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no migration.
- Existing `v0.1.28` binaries do not contain `forma self-update`. Users must install `v0.1.29` once through the official install script, mise, WinGet, an editor lifecycle, or another existing manager. Install-script-owned `v0.1.29` binaries can then self-update to later releases.
- Installations created by older official scripts do not yet have an ownership receipt; reinstalling `v0.1.29` through the current script establishes ownership.
- mise, WinGet, editor-managed, other package-manager, and manual installations may use `forma self-update --check`, but must continue updating through their owning manager.
- Passive update notifications, channels, arbitrary download URLs, automatic package-manager invocation, signed provenance beyond published checksums, and a permanent launcher remain out of scope.
- Main-branch static-site deployment remains independent from the versioned CLI and editor-extension release.

## Release Notes

> Forma `v0.1.29` gives official install-script users an explicit, checksum-verified way to check for and install Forma releases while preserving package-manager and editor ownership boundaries.

## Published Evidence

- **Candidate:** `f187d2b08120e66da60e99cb6c41cb8c57e96f2c`.
- **Exact main CI:** [run 30530099030](https://github.com/choral-io/choral-forma/actions/runs/30530099030) passed the knowledge, Web, Rust, installer, static-site, VS Code, and five-target Release-build gates. The annotated `v0.1.29` tag resolves to this exact commit.
- **Publication:** [Release run 30530989657](https://github.com/choral-io/choral-forma/actions/runs/30530989657) promoted the source-bound candidate, verified the published release, and published or verified the Marketplace package.
- **GitHub Release:** [Forma v0.1.29](https://github.com/choral-io/choral-forma/releases/tag/v0.1.29) is a non-draft, non-prerelease Release published on 2026-07-30 with the exact 22-file asset contract.
- **Independent verification:** `mise run release:verify -- v0.1.29` passed for all 22 assets and 11 payloads. The native macOS Arm64 CLI reported `forma 0.1.29` with SHA-256 `54c72faf8e223fe225e68376127cd1f5539ada7fcc21599c4c1685484a0eedd7`; the VSIX reported `choral-io.forma@0.1.29`, engine `^1.110.0`, and SHA-256 `dcae6252ac449893acf3bdd15d90ad804400520560f2bfe6e7bb94907367474f`.
- **Marketplace:** the public `choral-io.forma` listing exposes `0.1.29` with the same VSIX SHA-256 as the GitHub Release.
- **Managed self-update:** a fresh official-script installation in an isolated directory wrote a `forma-install-script` ownership receipt for `0.1.29`. `forma self-update --check --json` reported `up-to-date` without mutation, and `forma self-update 0.1.29 --reinstall --yes --json` completed with `status: updated`; the final binary and receipt remained at `0.1.29` with no replacement-state files left behind.

## Release Recovery Evidence

- The first publication attempt stopped before tagging because the `release-production` Environment was absent. The Environment was restored with a required reviewer before retrying.
- Two later attempts exposed draft-Release recovery defects: the REST tag endpoint does not return drafts, and a just-created draft is not guaranteed to appear immediately in the Release list. Both attempts left empty drafts and unpublished tags, which were verified and removed before recreating the candidate identity.
- The final workflow creates a draft from the REST response directly and resolves an existing draft by immutable Release ID. Workflow-contract regression checks preserve that recovery path.

## Rollback Plan

Do not move or overwrite a published tag, Marketplace version, or verified asset. Before publication, return a failed candidate to remediation. After publication, use the official installer as the recovery path and publish a higher coordinated version for any correction.

## Post-Release Follow-Up

- Real in-place replacement is verified on macOS Arm64. Linux x64 and Arm64, macOS x64, and Windows x64 passed the self-update contract and native-binary execution in CI, but their real in-place replacement paths remain Host-specific validation boundaries.
- Remote SSH, Dev Container, WSL, code signing, and notarization remain outside this release evidence.
- The Release workflow rebuilds candidate artifacts after the exact main CI has already built the same matrix. Preserve source binding and immutable candidate validation while evaluating safe cross-workflow artifact reuse as a separate optimization.
