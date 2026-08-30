---
schemaVersion: 1
kind: release
title: "Forma v0.1.34"
summary: "Explicit structured-artifact schema validation through forma tools, clarified workspace contracts, and a coordinated toolchain refresh."
scope: project
type: release
status: planned
version: "v0.1.34"
date: 2026-08-30
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - cli
    - schema
    - tools
    - documentation
    - dependencies
    - vscode
    - zed
relatedTasks:
    - "tasks/design-guided-knowledge-modeling-flow"
relatedTestCases:
    - "test-cases/forma-cli-docs-bootstrap"
    - "test-cases/forma-starter-kit/numeric-schema-type-contract"
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.34

## Scope

Publish the next coordinated Public Preview patch after [[releases/forma-v0.1.33]]. This cutline adds an explicit, read-only `forma tools schema.validate` path for structured JSON, YAML, and JSONL artifacts, clarifies the workspace and Agent contracts around that tool, and refreshes the supported frontend toolchain.

## Included Changes

- Add a compiled-in, read-only `forma tools` registry with `list`, `describe`, and `schema.validate` contracts shared by the CLI and RPC surfaces.
- Validate one explicit JSON, single-document YAML, or JSONL file against a local JSON Schema with structured diagnostics, JSON Pointer paths, line locations, and no network `$ref` resolution or auto-fix.
- Keep structured-artifact validation separate from the native Forma Schema DSL used for Markdown frontmatter and configured space constraints.
- Clarify public workspace and Agent guidance, add the CLI tools documentation route, and extend executable documentation and workspace-fixture coverage.
- Refresh the coordinated Node, pnpm, frontend, and Wrangler dependencies and keep CLI, VS Code, and Zed versions aligned at `0.1.34`.

Automatic artifact declarations and workspace-wide `forma check` integration remain explicitly deferred; the manual tool is the current MVP and the stable seam for a future opt-in phase.

## Validation

1. `mise run version:check -- v0.1.34` and `mise run release:record-check -- v0.1.34` pass from the exact candidate.
2. Forma configuration, content, and workspace-health checks pass with zero errors and zero warnings.
3. `CI=true mise run check` passes from the exact aligned candidate.
4. The coordinated `forma-0.1.34.vsix` packages and passes isolated installation, activation, and LSP smoke gates with a matching `forma 0.1.34` binary.
5. Main CI passes for the exact candidate commit before the annotated tag is created.
6. The protected Release workflow builds the expected cross-platform archives, standalone binaries, VSIX, and sibling SHA-256 assets from the exact source.
7. After publication, `mise run release:verify -- v0.1.34` verifies the published asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Rollout Plan

1. Complete and commit the aligned `0.1.34` candidate and its release metadata without publishing external artifacts.
2. Push the candidate and require green main CI for the exact commit.
3. Create and push annotated tag `v0.1.34` only after the exact candidate is green.
4. Observe the tag-triggered Release workflow and run the executable published-release verification gate.
5. Record immutable publication evidence in a separate post-release commit before marking this release `released`.

## Migration Or Operations Notes

- Existing workspaces require no migration; structured validation is opt-in through an explicit command.
- Keep JSON Schema files and structured data under the workspace boundary. Network and non-file `$ref` resolution is disabled.
- Keep Markdown frontmatter and space constraints on the native Forma Schema DSL; do not infer structured-artifact declarations from directory names.
- The release remains a Public Preview and preserves the coordinated CLI, VS Code, and Zed version contract.
- Remote SSH, Dev Container, WSL, code signing, notarization, Zed Registry publication, and non-native in-place replacement paths remain bounded acceptance areas unless exact release evidence closes them.

## Release Notes

> Forma `v0.1.34` adds the explicit, read-only `forma tools schema.validate` workflow for structured JSON, YAML, and JSONL artifacts, clarifies the workspace and Agent contracts, and refreshes the coordinated toolchain.

## Rollback Plan

Do not move or overwrite a published tag or asset. Before publication, return a failed candidate to remediation. After publication, use the official installer as the recovery path and publish a higher coordinated version for any correction.

## Post-Release Follow-Up

- Reopen automatic artifact declarations and `forma check` integration only after repeated workspace evidence and an accepted opt-in contract.
- Continue the product-value roadmap through guided knowledge modeling and external validation rather than treating this technical contract release as product-value evidence.
