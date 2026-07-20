---
schemaVersion: 1
kind: release
title: Forma v0.1.22
summary: First Marketplace-ready Public Preview with one coordinated numeric version across the CLI and editor extensions.
scope: project
type: release
status: planned
version: v0.1.22
date: 2026-07-20
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - marketplace
    - vscode
    - zed
    - cli
relatedTasks:
    - "tasks/package-vscode-extension-vsix"
    - "tasks/integrate-vsix-ci-release-artifact"
    - "tasks/manage-vscode-forma-cli-lifecycle"
    - "tasks/validate-vscode-lsp-remote-and-performance"
relatedTestCases:
    - "test-cases/forma-starter-kit"
---

# Forma v0.1.22

## Scope

Publish the first Marketplace-ready Forma Public Preview. The release replaces the internal `0.1.0-alpha.N` suffix with a coordinated numeric `0.1.22` version across the CLI, VS Code extension, and Zed extension while preserving exact cross-component compatibility.

The VS Code extension uses the regular public Marketplace channel with its existing `preview: true` maturity marker. Version `0.1.22` represents the twenty-second preview iteration; it is not a production-stability claim.

## Included Changes

- Align Cargo packages, the Forma CLI, VS Code extension, Zed extension, release assets, install examples, and tag identity at `0.1.22`.
- Replace internal VSIX-only instructions with Marketplace installation, an offline VSIX fallback, and a concise first-run workflow.
- Keep checksum-verified, confirmation-gated installation of the exact matching Forma CLI.
- Correct the public feature list to include the shared Graph View renderer delivered in earlier alpha releases.
- Keep the Forma extension visibly marked as Preview in Marketplace metadata.
- Include the Forma brand banner added after Alpha 21.

## Validation

Required candidate evidence:

1. `mise run version:check -- v0.1.22` passes.
2. `CI=true mise run check` passes from the exact aligned candidate.
3. Forma config and content checks pass; workspace health has no release-blocking diagnostics.
4. `forma-0.1.22.vsix` packages with the expected public identity, Preview marker, icon, bundled runtime, README, Changelog, license, and notices.
5. The packaged VSIX installs and activates in an isolated VS Code profile with the matching `forma 0.1.22` CLI.
6. Main CI passes for the exact candidate commit before the annotated tag is created.
7. The tag-triggered Release workflow publishes the expected archives, standalone binaries, VSIX, and sibling SHA-256 files.
8. `mise run release:verify -- v0.1.22` validates the published release, current-host CLI, VSIX identity, and managed-install path.
9. The Publisher portal accepts `choral-io.forma@0.1.22`, and a clean VS Code Stable profile installs and activates it from Marketplace.

## Rollout Plan

1. Complete and commit the aligned `0.1.22` candidate without publishing external artifacts.
2. Push the candidate and require green main CI for the exact commit.
3. Create and push annotated tag `v0.1.22` only after the exact candidate is green.
4. Observe the tag-triggered GitHub Release workflow and run the executable published-release verification gate.
5. Confirm that the Publisher account owns the immutable `choral-io` publisher identifier.
6. Upload the verified `forma-0.1.22.vsix` through the Marketplace Publisher portal as a regular public version.
7. Install from Marketplace in a clean VS Code Stable profile and verify activation, Workspace Trust behavior, and matching CLI acquisition.
8. Record immutable GitHub and Marketplace publication evidence in a separate post-release commit before marking this release `released`.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no migration.
- Users of `0.1.0-alpha.21` must update both the extension and CLI to `0.1.22`; mixed versions remain intentionally incompatible.
- The Marketplace release is a Public Preview even though it uses the regular public installation channel.
- Local workspaces are the release gate. Remote SSH, Dev Container, WSL, high-contrast, reduced-motion, long-running resource, and full-scale validation remain bounded by the recorded evidence.
- Marketplace publisher creation or ownership confirmation requires an authenticated maintainer and is not performed by repository automation.

## Release Notes

> Forma `v0.1.22` is the first Marketplace-ready Public Preview. It keeps Markdown files and explicit schemas as the source of truth, adds editor-native navigation and themed View previews, and maintains one checksum-verified version across the CLI and editor extensions.

## Rollback Plan

Do not move or overwrite the `v0.1.22` tag or reuse the Marketplace extension version after publication. If validation finds a blocker before publication, return the candidate to remediation. If a blocker is found after publication, stop rollout and publish a higher coordinated patch version after remediation.

## Post-Release Follow-Up

- Add automated Marketplace publishing only after the first manual publication and clean-profile install have been verified.
- Capture Marketplace acquisition and issue feedback without adding product telemetry.
- Reassess when the Preview marker can be removed and which compatibility guarantees are required for the next minor milestone.
