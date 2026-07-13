---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.17
summary: Internal alpha that aligns the VS Code extension with an explicitly installed, verified Forma CLI.
scope: project
type: release
status: ready
version: v0.1.0-alpha.17
date: 2026-07-13
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - vscode
    - cli
    - remote
    - validation
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedTasks:
    - "tasks/manage-vscode-forma-cli-lifecycle"
---

# Forma v0.1.0-alpha.17

## Purpose

Publish the coordinated CLI lifecycle completed after [[releases/forma-v0.1.0-alpha.16]]. The extension must no longer report a stale or incompatible CLI as ready, and users must be able to install the exact matching release binary explicitly inside the local or remote Extension Host.

## Scope

- Require exact VS Code extension and Forma CLI version equality during the coordinated Alpha line.
- Resolve an explicit machine-level `forma.path` first, a verified managed binary second, and the Extension Host `PATH` last.
- Offer an explicit, cancellable installation command that downloads the matching GitHub Release binary and checksum into versioned extension storage without modifying `PATH`.
- Publish standalone editor-managed binaries and sibling SHA-256 files for macOS arm64/x64, Linux glibc arm64/x64, and Windows x64 while retaining the existing archives.
- Distinguish CLI and Explorer command failures from the absence of a Forma workspace, and record the resolved binary source in Forma Output.
- Prevent stale runtime refreshes and cancelled install flights from winning later work.
- Make interrupted response cleanup and Windows executable replacement recoverable without reporting a successful replacement as failed solely because a backup remains locked.
- Keep Restricted Mode free from downloads, CLI selection, and CLI execution.
- Verify that the packaged extension opens the native Markdown Preview rather than merely accepting a Preview command.

## Release Gates

1. `CI=true mise run check` passes locally after the aligned version update.
2. `mise run version:check -- v0.1.0-alpha.17` passes.
3. Forma config, content checks, and workspace health pass.
4. Focused managed-install tests cover checksum, size, timeout, cancellation, single-flight retry, cleanup, and Windows replacement/rollback behavior.
5. Restricted Mode tests invoke both managed CLI recovery commands and observe neither execution nor download.
6. A packaged `forma-0.1.0-alpha.17.vsix` installs in an isolated profile and opens real native Markdown Preview tabs for supported Views.
7. Tag CI validates the exact five-platform release matrix, builds the CLI and extension, runs Extension Host and packaged VSIX smoke tests, and publishes every archive, standalone binary, VSIX, and sibling checksum.
8. The published macOS arm64 standalone binary and VSIX pass downloaded checksum, binary-version, and manifest-identity verification.
9. The extension completes one real managed installation from the published Alpha 17 assets before [[tasks/manage-vscode-forma-cli-lifecycle]] moves to `done`.

## Known Boundaries

- Managed installation is always user initiated; there is no silent download or automatic update.
- Linux musl/Alpine, Marketplace publication, signing, and notarization remain out of scope.
- Local workspaces remain the release gate. Remote placement uses the remote Extension Host and its `globalStorageUri`, but a live SSH, Dev Container, or WSL environment is not currently available for end-to-end validation.
- Graph rendering remains a separate focused project.

## Validation

- The remediation review identified and closed cancelled-flight reuse, stale refresh overwrite, Windows backup cleanup, Windows `code.cmd` launch, packaged Preview false-positive, Restricted Mode command-entry, release-matrix, and test temporary-directory gaps.
- Focused extension validation passed 114 Vitest tests, 14 Node release/script tests, TypeScript checks, and the Restricted Mode suite in an isolated profile using the installed official VS Code application.
- Existing leaked `forma-managed-cli-*` and `forma-download-*` test directories were removed; the new cleanup fixture leaves zero matching directories after the focused suite.
- `CI=true mise run check` passed locally with aligned `0.1.0-alpha.17` versions, 128 TypeScript tests, 14 release/script tests, 234 Rust tests, formatting, lint, type checks, and production builds.
- Forma config inspection and workspace health passed with zero diagnostics.
- `forma-0.1.0-alpha.17.vsix` installed and activated in an isolated profile under the installed official VS Code 1.128.0 application. The smoke suite verified navigation and editable source behavior, then observed a newly created native Markdown Preview Tab for every list, table, kanban, and Graph View.
- The local VSIX manifest reports `choral-io.forma@0.1.0-alpha.17`, and its SHA-256 is `36d7bfec8a1a9573af87979b04476491ad5a1b7c39821ddf30db1a7f26e95553`.
- CI, published-asset, and real managed-download gates are recorded below when they complete.

## Release Notes

> Forma `v0.1.0-alpha.17` makes the VS Code extension and CLI lifecycle explicit and predictable. It rejects incompatible CLI versions, can install the exact checksum-verified release binary into local or remote extension storage on request, preserves user-managed configuration precedence, and improves diagnostics when CLI-backed Explorer operations fail.

## Rollback Plan

Do not move or overwrite the Alpha 17 tag after publication. If internal testing finds a release blocker, stop distributing Alpha 17, record the failure, and publish a new aligned prerelease after correction.

## Post-Release Follow-Up

- Validate one representative Remote SSH, Dev Container, or WSL workspace when an environment is available.
- Define a bounded policy for retaining older managed CLI versions after enough internal upgrade experience exists.
- Consider stronger signed provenance independently from the current sibling-checksum trust model.
