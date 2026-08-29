---
schemaVersion: 1
kind: release
title: "Forma v0.1.33"
summary: "Strict numeric Schema scalar semantics with coordinated workspace documentation and contract coverage."
scope: project
type: release
status: planned
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

## Rollout Plan

1. Complete and commit the aligned `0.1.33` candidate and its release metadata without publishing external artifacts.
2. Push the candidate and require green main CI for the exact commit.
3. Create and push annotated tag `v0.1.33` only after the exact candidate is green.
4. Observe the tag-triggered Release workflow and run the executable published-release verification gate.
5. Record immutable publication evidence in a separate post-release commit before marking this release `released`.

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
