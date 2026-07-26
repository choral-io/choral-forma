---
schemaVersion: 1
kind: release
title: Forma v0.1.24
summary: Public Preview update for resilient Mermaid reading, sticky Table and Kanban headers, and aligned editor package identity.
scope: project
type: release
status: released
version: v0.1.24
date: 2026-07-26
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - webapp
    - markdown
    - mermaid
    - views
    - vscode
    - zed
    - cli
relatedTasks:
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "tasks/optimize-sticky-headers-in-view-rendering"
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedExperiments: []
relatedMetrics:
    - "metrics/knowledge-workflow-replacement-readiness"
---

# Forma v0.1.24

## Scope

Publish the next coordinated Forma Public Preview update after `v0.1.23`. This candidate keeps the CLI, VS Code extension, and Zed extension on the same numeric version while adding resilient WebApp Mermaid reading, stable sticky View presentation, and a single public editor-package display name.

The release remains a Public Preview. The regular numeric version and public Marketplace channel do not represent a production-stability claim.

## Included Changes

- Render the supported Mermaid subset in the WebApp through a bounded Worker boundary with sanitization, no remote font or stylesheet loading, accessible source fallback, and native zoom controls.
- Keep configured Table headers and Kanban column headers visible in the View-owned scroll surface, including variable-height Kanban header measurement and explicit Table column presentation.
- Add reusable validation fixtures and focused tests for rich Markdown reading, Mermaid behavior, responsive navigation, Table overflow, and Kanban sticky-header boundaries.
- Align the CLI, VS Code extension, Zed extension, lockfile, install examples, release record, and expected tag at `0.1.24` / `v0.1.24`.
- Align the source VSIX display name with the published Marketplace identity: `Forma by Choral`, while preserving the stable extension identity `choral-io.forma`.

## Validation

Required candidate evidence:

1. `mise run version:check -- v0.1.24` passes.
2. `CI=true mise run check` passes from the exact aligned candidate.
3. Forma config inspection, content checks, and workspace health pass with no release-blocking diagnostics.
4. `forma-0.1.24.vsix` packages with `choral-io.forma`, display name `Forma by Choral`, the Preview marker, bundled runtime, README, Changelog, license, and notices.
5. The packaged VSIX smoke test passes with the matching `forma 0.1.24` development CLI.
6. Main CI passes for the exact candidate commit before the annotated tag is created.
7. The tag-triggered Release workflow publishes the expected archives, standalone binaries, VSIX, and sibling SHA-256 files.
8. `mise run release:verify -- v0.1.24` validates the published release, current-host CLI, VSIX identity, checksums, and managed-install path.
9. Any Marketplace upload and clean-profile installation are performed only with separate maintainer authorization.

Completed candidate and immutable GitHub publication evidence:

- Candidate commit: `31a2bb559af0e43a381dcd832f614676ce2f38d7`.
- `mise run version:check -- v0.1.24`, the complete local `CI=true mise run check` gate, Forma config and content checks, local VSIX packaging, and isolated packaged-VSIX activation passed before tagging. Workspace health reported one non-blocking no-backlink warning for this new release record.
- [Main CI run 30204900999](https://github.com/choral-io/choral-forma/actions/runs/30204900999) passed Knowledge, Web, Rust, and VS Code Extension for the exact candidate commit before tagging.
- Annotated tag `v0.1.24` has tag object `6f6714095e3408f167a9de7cf4a4745fdab943c0` and points to the exact candidate commit.
- [Release workflow run 30205337876](https://github.com/choral-io/choral-forma/actions/runs/30205337876) passed its version gate, VS Code Extension build and smoke test, five platform builds, and GitHub Release publication for the exact candidate commit.
- [GitHub Release v0.1.24](https://github.com/choral-io/choral-forma/releases/tag/v0.1.24) was published on 2026-07-26 as a regular, non-draft release with the exact expected 22 assets: the VSIX and checksum; standalone Linux arm64, Linux x64, macOS arm64, macOS x64, and Windows x64 binaries and checksums; and the five matching archives and checksums.
- `mise run release:verify -- v0.1.24` passed. The verified macOS arm64 CLI reports `forma 0.1.24` with SHA-256 `4acb51a5185c9ebbe5da1f489839e9bbd35ee6956516f8e1b25f65cce9737827`; the VSIX reports `choral-io.forma@0.1.24`, engine `^1.110.0`, and SHA-256 `6d86cd997cf73177b61878e03f2ea640ae23f1346b407b4df5cba89e61776b86`. The production managed-install verification selected `forma-macos-arm64` and confirmed `forma 0.1.24`.

## Rollout Plan

1. Commit the aligned `0.1.24` candidate without creating a tag or publishing external artifacts.
2. Push the candidate and require green main CI for the exact commit.
3. Create and push annotated tag `v0.1.24` only after the exact candidate is green and a maintainer separately approves the tag decision.
4. Observe the tag-triggered Release workflow and run the executable published-release verification gate.
5. Upload the verified VSIX to Marketplace only after separate maintainer authorization.
6. Install from Marketplace in a clean VS Code Stable profile and verify activation, Workspace Trust behavior, and matching CLI acquisition.
7. Record immutable publication evidence in a separate post-release commit before marking this release `released`.

## Migration Or Operations Notes

- Existing Forma workspaces and Markdown content require no schema or content migration.
- Users must update the CLI and editor extension together; mixed `0.1.23` and `0.1.24` components remain intentionally incompatible.
- The stable Marketplace identity remains `choral-io.forma`; this candidate reconciles its source and GitHub Release VSIX display name to `Forma by Choral`.
- Marketplace publication remains manually authorized. No `0.1.24` Marketplace upload or clean-profile Marketplace installation is claimed by this record. Automated publishing is intentionally deferred until publisher-managed credentials and an approval gate are configured.
- Remote SSH, Dev Container, WSL, high-contrast, reduced-motion, long-running resource, and full-scale validation remain unverified unless post-release evidence names a completed test.

## Release Notes

> Forma `v0.1.24` makes rich Markdown and configured Views more reliable in the Public Preview: supported Mermaid diagrams render safely with understandable fallbacks, Table and Kanban headers remain visible while reading, and every shipped VSIX carries the same Forma by Choral identity.

## Rollback Plan

Do not move or overwrite the `v0.1.24` tag or reuse a published Marketplace extension version. If validation finds a blocker before publication, return the candidate to remediation. If a blocker is found after publication, stop rollout and publish a higher coordinated version after remediation.

## Post-Release Follow-Up

- Record the exact candidate commit, main CI run, Release workflow run, GitHub Release URL, asset inventory, checksums, CLI version, VSIX identity, and managed-install result.
- Verify clean-profile Marketplace acquisition, activation, and Workspace Trust behavior if that additional rollout evidence is required.
- Before automating Marketplace publication, configure publisher-managed credentials or trusted publishing together with a separately approved GitHub Environment gate.
