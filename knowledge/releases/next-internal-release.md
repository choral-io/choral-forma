---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.14
summary: Internal corrective prerelease for the post-Alpha 13 core and VS Code extension fixes.
scope: project
type: release
status: validating
version: v0.1.0-alpha.14
date: 2026-07-12
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - validation
relatedTestCases:
    - "test-cases/forma-starter-kit"
---

# Forma v0.1.0-alpha.14

## Purpose

Publish the corrective changes merged after [[releases/forma-v0.1.0-alpha.13]] as a new aligned binary and VSIX release without moving or overwriting the Alpha 13 tag.

## Scope

- Correct the VS Code reference-token end boundary so definition and hover lookup do not claim the first character after a reference.
- Require the canonical `<!-- forma:content -->` view mount and return an actionable migration diagnostic for legacy `<!-- forma-view -->` markers.
- Include the reviewed VSIX output naming and Extension Host test-environment fixes.
- Expand released-package smoke coverage for workspace discovery, supported link forms, source opening, and list/table/kanban/Graph preview commands.
- Remove the obsolete Foam recommendation now that Forma supplies the workspace navigation path used by this repository.

Graph remains intentionally deferred. This release does not add a graph renderer or widen the editor-extension feature scope.

## Validation

Required gates:

1. `CI=true mise run check` passes locally.
2. Forma config, content checks, and workspace health pass.
3. The VSIX package contents and disposable installed-extension smoke pass.
4. PR and merged-main CI pass.
5. Tag `v0.1.0-alpha.14` points to the verified merge commit.
6. The Release workflow publishes all binary archives, the VSIX, and sibling checksum files.
7. Downloaded checksums pass; the binary and VSIX both report `0.1.0-alpha.14`.

Current result:

- Version consistency passed for `v0.1.0-alpha.14`; Cargo metadata accepted the locked dependency graph.
- Focused VS Code reference/client tests passed 12 tests, and the remediation script suite passed 3 tests.
- `CI=true mise run check` passed pnpm checks, lint, tests, production builds, Rust formatting/checks, and the full Rust test suite.
- VSIX package contents resolve to `forma-0.1.0-alpha.14.vsix` with the expected manifest, README, changelog, license, and bundled extension entrypoint.
- `forma check --json` and `forma workspace health --json` passed with zero diagnostics.
- PR CI, merged-main CI, tag publication, Release workflow, and downloaded-artifact verification remain pending.

## Rollout Plan

1. Prepare and validate the release on `codex/alpha14-release`.
2. Merge only after required PR checks pass.
3. Confirm merged-main CI before creating tag `v0.1.0-alpha.14`.
4. Let the tag-triggered Release workflow build and publish all artifacts.
5. Verify downloaded artifacts before distributing the Alpha 14 VSIX internally.

## Release Notes

Draft release note:

> Forma `v0.1.0-alpha.14` publishes the reviewed corrections made after Alpha 13. It tightens VS Code reference-token boundaries, enforces the canonical source-backed View mount with a migration diagnostic for the legacy marker, and strengthens released-VSIX validation across navigation and View preview commands.

## Rollback Plan

Do not move or overwrite either published prerelease tag. If validation finds a release blocker, leave Alpha 14 unpublished, record the failure, and prepare a new candidate after the correction is verified.

## Post-Release Follow-Up

- Continue internal testing in real VS Code configurations and remote workspaces where available.
- Keep Graph implementation as a separate focused project.
