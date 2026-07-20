---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.21
summary: Internal alpha for the new Forma icon, stricter cross-Host Graph parity, release-record cleanup, and compatible dependency updates.
scope: project
type: release
status: released
version: v0.1.0-alpha.21
date: 2026-07-20
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - branding
    - graph
    - vscode
    - webapp
    - dependencies
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedTasks:
    - "tasks/design-editor-graph-view-renderer"
    - "tasks/validate-shared-graph-view-cross-host-parity"
---

# Forma v0.1.0-alpha.21

## Purpose

Publish the focused maintenance and parity improvements completed after [[releases/forma-v0.1.0-alpha.20]]. This release introduces the accepted Forma icon across the WebApp and VS Code package, reduces remaining Host-local Graph presentation logic, and refreshes compatible project dependencies without widening the product scope.

## Scope

- Add `assets/brand/forma-icon.svg` as the canonical vector icon source.
- Replace the WebApp favicon and package a 256-by-256 PNG icon in the VS Code extension manifest.
- Move Graph projection normalization into the shared `@choral-forma/graph-view/projection` entrypoint.
- Move selected-node summary and expand-control presentation into the shared `@choral-forma/graph-view/presentation` entrypoint.
- Add fixture-driven parity tests proving that WebApp and VS Code normalize empty, small, medium, and large Graph projections identically.
- Close the stale shared Graph renderer design task while leaving the active cross-Host validation boundaries explicit.
- Archive the Alpha 14 release under its immutable versioned path and remove obsolete rolling-release references from reusable validation material.
- Include the reviewed compatible Rust and pnpm dependency upgrades and refreshed lockfiles.

## Release Gates

1. `mise run version:check -- v0.1.0-alpha.21` passes.
2. `CI=true mise run check` passes from the exact aligned candidate.
3. Forma config and content checks pass; workspace health has no release-blocking diagnostics.
4. A local `forma-0.1.0-alpha.21.vsix` packages with the new icon and passes the packaged-extension smoke test.
5. The complete candidate is committed and pushed before main CI is evaluated.
6. Main CI passes for the exact candidate commit before the annotated tag is created.
7. The tag-triggered Release workflow publishes the expected archives, standalone binaries, VSIX, and sibling SHA-256 files.
8. `mise run release:verify -- v0.1.0-alpha.21` validates the published release, current-host CLI, VSIX identity, and production VS Code managed-install path.

## Known Boundaries

- The remaining real Remote Extension Host, live high-contrast and reduced-motion, long-running resource profiling, and full scale measurements remain tracked by [[tasks/validate-shared-graph-view-cross-host-parity]].
- This release does not add Graph grouping, filtering, editable relationships, or a 3D renderer.
- The WebApp remains in maintenance mode; the new favicon keeps branding aligned but does not change product-surface priority.
- The Zed extension remains an internal Dev Extension and requires a matching preinstalled CLI on the worktree `PATH`.

## Validation

Local candidate validation on 2026-07-20 established the release baseline:

- `mise run version:check -- v0.1.0-alpha.21` passed after adding regression coverage for versioned Markdown release-record links.
- `CI=true mise run check` passed with 37 Vitest files and 206 tests, 23 Node tooling tests, the complete Rust workspace tests, formatting, linting, TypeScript checks, production builds, and the Zed `wasm32-wasip1` check.
- Forma config inspection and `forma check --json` passed without diagnostics. Workspace health reported seven non-blocking no-backlink warnings, including this release record.
- `forma-0.1.0-alpha.21.vsix` packaged 57 files at 205.2 KB and included the 256-by-256 Marketplace icon.
- An isolated profile of the production VS Code installation verified `choral-io.forma@0.1.0-alpha.21` installation and activation, with 69.6 ms activation, 35.0 ms cold Definition, 53.8 ms warm Definition p95, 1.8 ms cold Document Link, and 1.9 ms warm Document Link p95.

Immutable publication evidence:

- Candidate commit: `878f6e9bbfb723a08d27bc9390ca0c454690673f`.
- [Main CI run 29740418724](https://github.com/choral-io/choral-forma/actions/runs/29740418724) passed Knowledge, Web, Rust, and VS Code Extension for that exact commit before tagging.
- Annotated tag: `v0.1.0-alpha.21`, created on the same candidate commit.
- [Release workflow run 29740674553](https://github.com/choral-io/choral-forma/actions/runs/29740674553) passed its version gate, VS Code Extension build and smoke test, five platform builds, and GitHub Release publication.
- [GitHub prerelease v0.1.0-alpha.21](https://github.com/choral-io/choral-forma/releases/tag/v0.1.0-alpha.21) contains the exact expected 22 assets.
- `mise run release:verify -- v0.1.0-alpha.21` passed. The verified macOS arm64 CLI reports `forma 0.1.0-alpha.21` with SHA-256 `18d4f7fae9268bc496bfd2f9d7bf73a4b30b4fe474e6efb78415a683246592f7`; the VSIX reports `choral-io.forma@0.1.0-alpha.21`, engine `^1.110.0`, and SHA-256 `dc95ade7a46e35e51004e71f7e063ef72b88146a300d90e559dc3e780c59bde7`. The managed-install verification selected the published `forma-macos-arm64` asset and confirmed the coordinated CLI version.

## Rollout Plan

1. Align all coordinated release versions at `0.1.0-alpha.21` and complete the changelog and release record.
2. Run the complete local candidate gate and package and smoke-test the VSIX.
3. Commit and push the exact candidate, then wait for main CI to pass on that commit.
4. Create and push annotated tag `v0.1.0-alpha.21` only after the exact candidate is green.
5. Observe the tag-triggered Release workflow and run the executable published-release verification gate.
6. Record immutable publication evidence in a separate post-release commit.

## Migration Or Operations Notes

- Existing Forma workspace configuration and Markdown content require no migration.
- VS Code users should install the Alpha 21 VSIX from the matching GitHub prerelease and keep the extension and Forma CLI versions aligned.
- Existing Graph View Markdown, theme configuration, and navigation behavior remain compatible.

## Release Notes

> Forma `v0.1.0-alpha.21` introduces the new Forma icon in the WebApp and VS Code package, strengthens shared Graph behavior with common projection and presentation helpers plus cross-Host parity tests, archives the historical Alpha 14 record correctly, and refreshes compatible Rust and TypeScript dependencies.

## Rollback Plan

Do not move or overwrite the Alpha 21 tag after publication. If internal testing finds a blocker, stop distributing Alpha 21, record the failure, and publish a new aligned prerelease after remediation.

## Post-Release Follow-Up

- Complete the remaining cross-Host Graph validation matrix.
- Evaluate additional product branding surfaces before extending the icon system.
- Continue dependency updates in reviewable batches with the complete release gate.
