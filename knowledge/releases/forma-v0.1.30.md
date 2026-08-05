---
schemaVersion: 1
kind: release
title: "Forma v0.1.30"
summary: "Publish receipt-free CLI updates, editor navigation intelligence, and validated FDE workspace examples."
scope: project
type: release
status: released
version: "v0.1.30"
date: 2026-08-05
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - cli
    - lsp
    - editors
    - examples
relatedTasks:
    - "tasks/remove-persistent-self-update-receipt"
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.30

## Scope

Publish the coordinated Public Preview update after [[releases/forma-v0.1.29]]. The candidate removes persistent installation receipts from new CLI installations, expands Core-owned editor navigation intelligence, aligns VS Code and Zed with LSP-owned version diagnostics, and adds executable FDE workspace examples and boundary gates.

## Included Changes

- Replace persistent `forma.install.json` ownership checks with transient, adjacent self-update transactions that validate recovery paths, reconcile interrupted replacements, and leave new installations single-file at rest.
- Preserve existing legacy receipt files byte-for-byte while making them inert; keep package-manager, editor-managed, mise, WinGet, and manual installations under their existing update owner.
- Add Core and LSP support for completion, hover, diagnostics, and references across Forma workspace links, wikilinks, aliases, fragments, embeds, and schema-declared entry references.
- Pass editor profile and extension version through LSP initialization options so the LSP owns coordinated-version warnings; provide VS Code recovery actions and installation guidance without a separate `forma --version` probe.
- Add synthetic FDE customer-project and team-practice workspaces with explicit content partitions, projected Agent Skills, cross-workspace boundary assertions, counterexample and revalidation evidence, and one unified examples gate.
- Refresh compatible Rust and pnpm dependencies, synchronize generated extension icons, and enforce the approved floating-major GitHub Actions policy.
- Record the decision to defer a Forma Core Host abstraction and WASM runtime until a concrete embedded-Host requirement justifies the boundary.

## Validation

1. `mise run version:check -- v0.1.30`, `mise run release:record-check -- v0.1.30`, and `CI=true mise run check` pass from the exact candidate.
2. Forma content checks and workspace health pass without diagnostics.
3. The unified examples gate discovers all configured examples, validates summary/check/health, exercises FDE partition Skills, preserves boundary counters at zero, and verifies positive, intentional-negative, adjusted, and fixture-test paths.
4. Unix and Windows installer regressions verify fresh receipt-free installation and preservation of existing legacy receipts.
5. A legacy install-script-owned `v0.1.29` installation can enter the explicit `v0.1.30` update flow; the resulting installation contains the new CLI while the old receipt remains inert and no transaction artifacts remain.
6. The coordinated `forma-0.1.30.vsix` packages and passes isolated integration and smoke gates with a matching `forma 0.1.30` binary.
7. The Release matrix builds and tests Linux x64 and Arm64, macOS x64 and Arm64, and Windows x64 assets from the exact source commit.
8. The complete candidate is pushed and main CI passes for its exact commit before tagging.
9. After publication, `mise run release:verify -- v0.1.30` verifies the asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Rollout Plan

- Commit and push the complete `v0.1.30` candidate only after local release gates pass.
- Create an annotated `v0.1.30` tag only after explicit maintainer approval and exact-source main CI success.
- Let the protected Release workflow publish the coordinated GitHub assets and Marketplace extension, then run independent published-release verification before recording immutable evidence.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no migration.
- Official-script `v0.1.29` installations have the ownership receipt required by that binary to start an update. After moving to `v0.1.30`, the receipt remains untouched but becomes inert; new `v0.1.30` installations do not create one.
- mise, WinGet, editor-managed, other package-manager, and manual installations remain owned by their existing manager and should continue updating through it.
- VS Code and Zed pass their profile and extension version to the LSP. A mismatched coordinated CLI remains usable for recovery, but the managed document receives a warning with installation guidance rather than an extension-startup version probe.
- Zed remains a Dev Extension in this release; Registry publication is a separate product and distribution decision.

## Release Notes

> Forma `v0.1.30` makes editor navigation more informative, keeps explicit CLI self-updates recoverable without persistent installation state, and adds executable examples for customer-project and team-practice FDE workflows.

## Published Evidence

- **Candidate:** `0cf545f42b0432c3a804bc17d2c8530702f64f4d`.
- **Exact main CI:** [run 31019630300](https://github.com/choral-io/choral-forma/actions/runs/31019630300) passed the knowledge, Web, Rust, installer, static-site, VS Code, five-target Release-build, and source-bound deployment gates. The annotated `v0.1.30` tag resolves to this exact commit.
- **Publication:** [Release run 31021109528](https://github.com/choral-io/choral-forma/actions/runs/31021109528) validated the exact candidate, assembled the immutable source-bound artifact set, promoted the GitHub Release, verified the published payloads, and published or verified the Marketplace package.
- **GitHub Release:** [Forma v0.1.30](https://github.com/choral-io/choral-forma/releases/tag/v0.1.30) is a non-draft, non-prerelease Release published on 2026-08-05 with the exact 22-file asset contract.
- **Independent verification:** `mise run release:verify -- v0.1.30` passed for all 22 assets and 11 payloads. The native macOS Arm64 CLI reported `forma 0.1.30` with SHA-256 `44aab8a6988d87a05585d24dd48e89d7e08e571b4fa71318a8c62d74e4cf6b57`; the VSIX reported `choral-io.forma@0.1.30`, engine `^1.110.0`, and SHA-256 `049829412d1392cbeab0a0fac90e9e8cf0068aa6b3e87293f29ed6a0f3c0d8ea`.
- **Managed installation:** the production editor-extension installation implementation downloaded, checksum-verified, installed, and executed the published `forma-macos-arm64` payload as `forma 0.1.30`, then cleaned its temporary and managed test storage.
- **Receipt-free transition:** exact-candidate installer and self-update gates verified fresh single-file installation, byte-preserving treatment of a legacy `forma.install.json`, a `v0.1.29` install-script-owned transition to `v0.1.30`, and cleanup of transient transaction artifacts.
- **Marketplace:** the protected Marketplace job authenticated through GitHub OIDC and published or verified `choral-io.forma@0.1.30` from the same immutable VSIX candidate.

## Rollback Plan

Do not move or overwrite a published tag, Marketplace version, or verified asset. Before publication, return a failed candidate to remediation. After publication, use the official installer as the recovery path and publish a higher coordinated version for any correction.

## Post-Release Follow-Up

- Keep Remote SSH, Dev Container, WSL, code signing, notarization, Zed Registry publication, and non-native in-place replacement paths explicit as unverified unless release evidence closes them.
