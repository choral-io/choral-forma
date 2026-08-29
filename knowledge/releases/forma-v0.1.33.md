---
schemaVersion: 1
kind: release
title: "Forma v0.1.33"
summary: "Strict numeric Schema scalar semantics with coordinated workspace documentation and contract coverage."
scope: project
type: release
status: released
version: "v0.1.33"
date: 2026-08-29
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - schema
    - numeric
    - cli
    - vscode
    - zed
relatedTasks:
    - "tasks/implement-schema-dsl-runtime-values"
relatedTestCases:
    - "test-cases/forma-starter-kit/numeric-schema-type-contract"
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.33

## Scope

Publish the next coordinated Public Preview patch after [[releases/forma-v0.1.32]]. This cutline closes the numeric Schema scalar contract for ordinary workspace configuration while preserving Forma's files-first Markdown and explicit-schema source of truth.

## Included Changes

- Support and document `number` and `integer` Schema fields with strict YAML-native scalar semantics and no coercion between numeric and string values.
- Keep quoted and zero-padded numeric-looking values as strings so lexical identifiers and formatting configuration remain stable.
- Add executable Core and CLI contract coverage plus an isolated workspace fixture for numeric Schema validation.
- Synchronize the CLI, VS Code extension, Zed extension, install examples, Changelog, and release metadata at `0.1.33`.

Numeric range constraints, finite-value policy, and WebApp/RPC cross-surface numeric behavior remain explicitly deferred follow-up work.

## Validation

1. `mise run version:check -- v0.1.33` and `mise run release:record-check -- v0.1.33` pass from the exact candidate.
2. Forma configuration, content, and workspace-health checks pass with zero errors and zero warnings.
3. `CI=true mise run check` passes from the exact aligned candidate.
4. The coordinated `forma-0.1.33.vsix` packages and passes isolated installation, activation, and LSP smoke gates with a matching `forma 0.1.33` binary.
5. Main CI passes for the exact candidate commit before the annotated tag is created.
6. The protected Release workflow builds the expected cross-platform archives, standalone binaries, VSIX, and sibling SHA-256 assets from the exact source.
7. After publication, `mise run release:verify -- v0.1.33` verifies the published asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Preparation Evidence

- **Exact release source:** merge commit `bf4ba164dfc565bc04a2a1fa3e1a2fdefbbea840` from PR [#9](https://github.com/choral-io/choral-forma/pull/9), with candidate head `94dec1ffd6a1ee3069adae852d7c7b1f6cf560e0`.
- **Local candidate gates:** `mise run version:check -- v0.1.33`, `mise run release:record-check -- v0.1.33`, Forma `check --json`, and workspace health passed with zero errors and zero warnings. `CI=true mise run check` passed with 67 pnpm test files/404 tests, a green Rust workspace, Zed WASM, TypeScript, ESLint, Prettier, WebApp, and VS Code builds.
- **Pull request CI:** [run 33244577301](https://github.com/choral-io/choral-forma/actions/runs/33244577301) passed all PR checks, including the five-platform CLI release-build verification.
- **Exact main CI:** [run 33244999476](https://github.com/choral-io/choral-forma/actions/runs/33244999476) passed all jobs for the exact merge commit before release dispatch.

## Rollout Plan

1. Completed and merged the aligned `0.1.33` candidate after green PR and exact-source main CI.
2. Dispatched the protected Release workflow from the exact `main` commit and approved its `release-production` environment gate.
3. Created and verified annotated tag `v0.1.33`, then promoted the source-bound candidate through the protected Release workflow.
4. Published the matching GitHub Release and VS Code Marketplace extension, then completed independent published-release verification.
5. Recorded this immutable publication evidence in a separate post-release commit.

## Published Evidence

- **Release workflow:** [run 33245487286](https://github.com/choral-io/choral-forma/actions/runs/33245487286) passed exact-source validation, all five CLI artifact builds, VS Code packaging, candidate assembly, promotion, published-release verification, and Marketplace publication.
- **Annotated tag:** `v0.1.33` resolves to merge commit `bf4ba164dfc565bc04a2a1fa3e1a2fdefbbea840`.
- **GitHub Release:** [Forma v0.1.33](https://github.com/choral-io/choral-forma/releases/tag/v0.1.33) is published as a non-draft, non-prerelease release with the expected 22 uploaded assets.
- **Independent verification:** `mise run release:verify -- v0.1.33` passed for 22 assets and 11 payloads. The native macOS Arm64 CLI reported `forma 0.1.33` with SHA-256 `953db9a96faec1b6f3744af4f0ca1f8aac56f698f980b5f4b50fbf4ca48e9ab1`; the VSIX reported `choral-io.forma@0.1.33`, engine `^1.110.0`, and SHA-256 `457f55e6ce8f574d50102d9313cb6fbe8fbcbfb3d1096e41e755d203ae3afe21`.
- **Managed installation:** the production editor-extension installation implementation downloaded, checksum-verified, installed, and executed the published `forma-macos-arm64` payload as `forma 0.1.33`.
- **Marketplace:** the protected Marketplace job published `choral-io.forma v0.1.33`.

## Migration Or Operations Notes

- Existing workspaces require no migration.
- `number` and `integer` fields validate YAML scalar types as authored; quoted or zero-padded values remain strings and should use `type: string` when lexical preservation is intended.
- `ordinalWidth` remains the lexical string value `"2"` so zero-padded ordinals remain stable.
- The release remains a Public Preview and preserves the coordinated CLI, VS Code, and Zed version contract.
- Remote SSH, Dev Container, WSL, code signing, notarization, Zed Registry publication, and non-native in-place replacement paths remain bounded acceptance areas unless exact release evidence closes them.

## Release Notes

> Forma `v0.1.33` adds strict numeric Schema scalar support for ordinary configuration, documents YAML type behavior, and makes the contract executable across Core, CLI, and an isolated workspace fixture.

## Rollback Plan

Do not move or overwrite a published tag or asset. Before publication, return a failed candidate to remediation. After publication, use the official installer as the recovery path and publish a higher coordinated version for any correction.

## Post-Release Follow-Up

- Evaluate numeric range constraints, finite-value policy, and WebApp/RPC cross-surface parity as separate follow-up work.
- Continue the product-value roadmap through guided knowledge modeling and external validation rather than treating this contract patch as product-value evidence.
