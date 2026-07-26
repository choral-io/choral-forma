---
schemaVersion: 1
kind: release
title: Forma v0.1.23
summary: Public Preview update with a simpler responsive WebApp, resilient Markdown rendering, config-driven projections, and refreshed editor packaging.
scope: project
type: release
status: released
version: v0.1.23
date: 2026-07-25
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - webapp
    - markdown
    - vscode
    - zed
    - cli
relatedTasks:
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "tasks/migrate-webapp-to-shared-graph-view"
    - "tasks/implement-vscode-extension-mvp"
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedExperiments: []
relatedMetrics:
    - "metrics/knowledge-workflow-replacement-readiness"
---

# Forma v0.1.23

## Scope

Publish the next coordinated Forma Public Preview update after `v0.1.22`. This release keeps the CLI, VS Code extension, and Zed extension on the same numeric version while consolidating the WebApp redesign, resilient Markdown reading, config-driven workspace projections, editor-extension relocation, and current toolchain.

The release remains a Public Preview. The regular numeric version and public Marketplace channel do not represent a production-stability claim.

## Included Changes

- Rebuild the read-only WebApp review surface on DaisyUI with a simpler responsive shell, stable sidebar and drawer behavior, theme selection, and a streamlined Quick Open experience.
- Drive workspace classifications and routes from configured taxonomy terms rather than example-specific built-ins.
- Render configured Table and Kanban projections alongside the existing list and graph View modes.
- Preserve entry titles and source metadata through Core, RPC, shared TypeScript, and WebApp boundaries.
- Add resilient Markdown rendering with workspace-aware links, syntax highlighting, KaTeX math, and readable fallbacks.
- Move the VS Code extension from `packages/vscode-extension` to `extensions/vscode` and align workspace globs, tests, CI, release packaging, version automation, and managed CLI verification.
- Refresh the coordinated Node.js, pnpm, TypeScript, lint, format, Vite, React, DaisyUI, and compatible Rust dependency baseline.

## Validation

Required candidate evidence:

1. `mise run version:check -- v0.1.23` passes.
2. `CI=true mise run check` passes from the exact aligned candidate.
3. Forma config inspection and content checks pass; workspace health has no release-blocking diagnostics.
4. `forma-0.1.23.vsix` packages with the expected public identity, Preview marker, bundled runtime, README, Changelog, license, and notices.
5. The packaged VSIX smoke test passes with the matching `forma 0.1.23` development CLI.
6. Main CI passes for the exact candidate commit before the annotated tag is created.
7. The tag-triggered Release workflow publishes the expected archives, standalone binaries, VSIX, and sibling SHA-256 files.
8. `mise run release:verify -- v0.1.23` validates the published release, current-host CLI, VSIX identity, checksums, and managed-install path.
9. Any Marketplace upload and clean-profile installation are performed only with separate maintainer authorization.

Completed candidate and immutable GitHub publication evidence:

- Candidate commit: `32d8d31f91e8dd609331922ae6aa5b9088cc4035`.
- `mise run version:check -- v0.1.23`, the complete local `CI=true mise run check` gate, Forma config and content checks, local VSIX packaging, and isolated packaged-VSIX activation passed before tagging. Workspace health reported nine non-blocking no-backlink warnings, including this release record.
- [Main CI run 30142247045](https://github.com/choral-io/choral-forma/actions/runs/30142247045) passed Knowledge, Web, Rust, and VS Code Extension for the exact candidate commit before tagging.
- Annotated tag `v0.1.23` has tag object `670bbe93a33c352769fe94e1c4a90b6ab585a780` and points to the exact candidate commit.
- [Release workflow run 30142555937](https://github.com/choral-io/choral-forma/actions/runs/30142555937) passed its version gate, VS Code Extension build and smoke test, five platform builds, and GitHub Release publication for the exact candidate commit.
- [GitHub Release v0.1.23](https://github.com/choral-io/choral-forma/releases/tag/v0.1.23) was published on 2026-07-25 as a regular, non-draft release with the exact expected 22 assets: the VSIX and checksum; standalone Linux arm64, Linux x64, macOS arm64, macOS x64, and Windows x64 binaries and checksums; and the five matching archives and checksums.
- `mise run release:verify -- v0.1.23` passed. The verified macOS arm64 CLI reports `forma 0.1.23` with SHA-256 `f72c6774c2017407cc5416981b5c5523ce61e5bfbd10b0abf732fc283725b4d7`; the VSIX reports `choral-io.forma@0.1.23`, engine `^1.110.0`, and SHA-256 `8688f81683cb375b1d90c2076c97bff7e24c97b0c98b9e83111db6a27b309d72`. The production managed-install verification selected `forma-macos-arm64` and confirmed `forma 0.1.23`.
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=choral-io.forma) publication was verified live in the maintainer's authenticated Edge session and independently through the public Marketplace registry on 2026-07-25. The listing reports stable identity `choral-io.forma`, version `0.1.23`, display name `Forma by Choral`, and Public Preview metadata.
- The Marketplace-served `0.1.23` VSIX is byte-identical to the intentionally local-only manual-upload artifact with SHA-256 `02f9aa6b53cbe3ae6b42edd7a6d6e1ba1461a266623ca8b5e7aa39432e19ce89`. Its ZIP integrity and embedded manifests verify publisher `choral-io`, name `forma`, version `0.1.23`, display name `Forma by Choral`, Preview `true`, and VS Code engine `^1.110.0`. Before upload, the same 57-file package passed the repository prepublish checks and disposable installation and activation as `choral-io.forma@0.1.23` with `forma 0.1.23`.
- The Marketplace VSIX intentionally differs from the immutable GitHub Release VSIX SHA-256 `8688f81683cb375b1d90c2076c97bff7e24c97b0c98b9e83111db6a27b309d72`. Extracted-content comparison found differences only in `extension/package.json#displayName` and `extension.vsixmanifest#DisplayName`, changing `Choral Forma` to `Forma by Choral`; publisher, extension name, version, code, and all other packaged files remain aligned. The tag, GitHub Release, and canonical source were not changed. CI-backed source and package reconciliation is deferred to the next normal coordinated release.
- Clean-profile acquisition and activation directly from Marketplace, Workspace Trust behavior after Marketplace installation, Remote SSH, Dev Container, WSL, signing, notarization, high-contrast, reduced-motion, long-running resource, and full-scale validation remain unverified.

## Rollout Plan

1. Complete and commit the aligned `0.1.23` candidate without creating a tag or publishing external artifacts.
2. Push the candidate and require green main CI for the exact commit.
3. Create and push annotated tag `v0.1.23` only after the exact candidate is green and a maintainer approves the tag decision.
4. Observe the tag-triggered GitHub Release workflow and run the executable published-release verification gate.
5. Upload the verified VSIX to Marketplace only after separate maintainer authorization.
6. Install from Marketplace in a clean VS Code Stable profile and verify activation, Workspace Trust behavior, and matching CLI acquisition.
7. Record immutable publication evidence in a separate post-release commit before marking this release `released`.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no schema or content migration.
- Users must update the CLI and editor extension together; mixed `0.1.22` and `0.1.23` components remain intentionally incompatible.
- The VS Code extension source moved within the repository, but the stable Marketplace identity remains `choral-io.forma`.
- Remote SSH, Dev Container, WSL, high-contrast, reduced-motion, long-running resource, and full-scale validation remain unverified unless post-release evidence names a completed test.

## Release Notes

> Forma `v0.1.23` refines the Public Preview around a simpler responsive WebApp, resilient Markdown reading, configuration-driven workspace projections, and coordinated editor packaging while keeping repository Markdown and explicit schemas as the source of truth.

## Rollback Plan

Do not move or overwrite the `v0.1.23` tag or reuse a published Marketplace extension version. If validation finds a blocker before publication, return the candidate to remediation. If a blocker is found after publication, stop rollout and publish a higher coordinated version after remediation.

## Post-Release Follow-Up

- Record the exact candidate commit, main CI run, Release workflow run, GitHub Release URL, asset inventory, checksums, CLI version, VSIX identity, and managed-install result.
- Before the next release, establish GitHub Actions-based VS Code Marketplace publishing and require CI to package and validate the intended display name and coordinated version used for the Marketplace upload.
- Verify clean-profile Marketplace acquisition, activation, and Workspace Trust behavior if that additional rollout evidence is required.
- Preserve the published tag, GitHub assets, and Marketplace version as immutable. Reconcile the canonical `Forma by Choral` display name through the next normal version bump and complete local and main CI release gates; any corrective release requires separate maintainer authorization.
