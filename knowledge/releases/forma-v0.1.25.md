---
schemaVersion: 1
kind: release
title: Forma v0.1.25
summary: Public Preview update for View entry links, resolved reference presentation, and Marketplace OIDC preflight.
scope: project
type: release
status: released
version: v0.1.25
date: 2026-07-27
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - views
    - vscode
    - webapp
    - cli
    - marketplace
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.25

## Scope

Publish the coordinated Public Preview update after [[releases/forma-v0.1.24]]. The candidate makes entry navigation explicit in Table Views, renders declared entry references with their resolved titles, and aligns the Core, WebApp, VS Code extension, Zed extension, CLI, and release assets at `0.1.25` / `v0.1.25`.

## Included Changes

- Add `link.target: entry` to configured Table columns, allowing any selected column to open the row entry without treating a particular field as the title.
- Preserve resolved `entryRef` and `entryRef` list values in the `view.render` contract, so projection hosts render target-title links rather than raw reference paths.
- Render those links in the WebApp and VS Code View projections while retaining native Markdown Preview ownership for VS Code source navigation.
- Update the project examples, validation fixtures, View documentation, and renderer contract documentation for entry links and reference fields.
- Refresh the coordinated workspace tooling dependencies.
- Add a protected `vscode-marketplace-publish` OIDC path: its manual preflight validates GitHub-to-Azure authentication, while an approved formal release publishes the already smoke-tested VSIX to Marketplace.

## Validation Plan

1. `mise run version:check -- v0.1.25` passes.
2. `CI=true mise run check` passes from the exact candidate commit.
3. Forma config inspection, content checks, and workspace health pass with no release-blocking diagnostics.
4. `forma-0.1.25.vsix` packages and passes the isolated smoke test with the matching `forma 0.1.25` development CLI.
5. The manually dispatched Marketplace identity preflight is approved through `vscode-marketplace-publish` and confirms Azure OIDC authentication without invoking `vsce publish`.
6. The complete candidate is pushed and main CI passes for its exact commit before any tag decision.
7. An annotated `v0.1.25` tag, GitHub Release publication, and Marketplace publication require explicit maintainer approval; the approved tag workflow uses `vsce publish --azure-credential` against the packaged VSIX.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no migration.
- `view.render` is a coordinated Core/RPC contract change: editor extensions and the CLI must be updated together to `0.1.25`.
- The Marketplace path uses a protected environment and GitHub OIDC. It does not introduce a stored Marketplace PAT; the tag-triggered publication is protected by the `vscode-marketplace-publish` environment approval gate.

## Release Notes

> Forma `v0.1.25` makes Views easier to navigate: configured Table columns can open their entries directly, and reference fields show the titles people recognize instead of raw paths.

## Release Evidence

- Immutable tag: `v0.1.25` at candidate commit `f36da633393771de1fa4f55f85bd4670d8b7ea29`.
- Candidate main CI: [run 30247714573](https://github.com/choral-io/choral-forma/actions/runs/30247714573) passed for that exact commit.
- Final GitHub Release and Marketplace publication: [run 30249952232](https://github.com/choral-io/choral-forma/actions/runs/30249952232) passed. Its workflow used the immutable `v0.1.25` source and the protected OIDC environment; the Marketplace job published the smoke-tested VSIX.
- Published release: [Forma v0.1.25](https://github.com/choral-io/choral-forma/releases/tag/v0.1.25) is non-draft, non-prerelease, and has the expected 22 assets.
- `mise run release:verify -- v0.1.25` passed on macOS ARM64: `forma-macos-arm64` reports `forma 0.1.25` with SHA-256 `b68031c0c9d3de0d1c5a59f7a9c2da77db6ef7e49b0010db1c291f26327c771b`; `choral-io.forma@0.1.25` reports engine `^1.110.0` with SHA-256 `2288fb9e22ae53dd19d7d2bfafc5666146c79e97f74064b095682ff4b8df1122`; managed install also executed `forma 0.1.25`.
- Remote SSH, Dev Container, WSL, signing, and notarization remain untested.

## Rollback Plan

Do not move or overwrite any published tag or Marketplace version. If validation finds a blocker, return the candidate to remediation; if a released artifact needs correction, publish a higher coordinated version.
