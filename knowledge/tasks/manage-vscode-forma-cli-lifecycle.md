---
schemaVersion: 1
kind: task
scope: project
title: Manage the VS Code Forma CLI lifecycle
summary: Enforce release-aligned CLI compatibility and let users explicitly install a verified matching binary inside the local or remote Extension Host.
type: task
priority: P1
value: H
module: app
effort: M
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - cli
    - installation
    - remote
blockedBy: []
relatedTo:
    - "tasks/implement-editor-extension-forma-command-client"
    - "tasks/align-forma-release-versioning"
    - "tasks/integrate-vsix-ci-release-artifact"
    - "releases/forma-v0.1.0-alpha.17"
sources:
    - "architecture/editor-extension-adapter-contract"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code extension CLI compatibility, acquisition, and release assets
---

# Manage The VS Code Forma CLI Lifecycle

## Goal

Prevent an apparently ready extension from invoking an incompatible Forma CLI, and provide an explicit, verified path to install the matching release without modifying system tool configuration.

## Sources

- [[architecture/editor-extension-adapter-contract]]
- [[tasks/implement-editor-extension-forma-command-client]]
- [[tasks/align-forma-release-versioning]]
- The Alpha 16 incident where a long-running VS Code Extension Host retained Forma Alpha 15 on `PATH`; discovery passed, `workspace explorer` exited with code 2, and the panel incorrectly reported no active workspace.

## In Scope

- Read the expected CLI version from the installed extension manifest and require exact equality during the coordinated Alpha release line.
- Report expected and actual versions, binary source, bounded command errors, and Explorer load failures accurately.
- Preserve an explicit machine-level `forma.path` as authoritative.
- Resolve a matching managed binary before extension-host `PATH` when no explicit path is configured.
- Add a user-initiated command that downloads the exact matching GitHub Release asset and checksum.
- Store binaries in a versioned directory under `ExtensionContext.globalStorageUri`, verify SHA-256, set executable permissions where required, and publish the file atomically.
- Keep downloads cancellable, single-flight, bounded, and recoverable after interruption or checksum failure.
- Add editor-oriented single-binary assets for macOS arm64/x64, Linux glibc arm64/x64, and Windows x64 while retaining existing archives.
- Keep local and remote installation in the workspace Extension Host and provide manual fallback when the host cannot reach GitHub Releases.
- Cover version, platform, checksum, partial-download, Restricted Mode, Extension Host, VSIX package, and release-asset behavior with focused tests.

## Out Of Scope

- Silent installation or automatic background updates.
- Modifying `PATH`, replacing a user-managed executable, or accepting a workspace-provided executable path.
- Transferring a locally downloaded binary into a remote host.
- Linux musl/Alpine release targets.
- Marketplace publishing, code signing, notarization, or a long-term SemVer compatibility matrix.
- Capability-based compatibility negotiation; that may replace exact Alpha version equality later.

## Acceptance Criteria

- An older or newer CLI cannot produce `Forma: Ready`; the status names both expected and detected versions and offers actionable recovery.
- Missing or incompatible CLI states offer install, existing-path, and documentation actions without downloading until the user chooses install.
- A matching managed CLI is selected deterministically from versioned extension storage and does not require a settings or `PATH` mutation.
- The downloader uses `v<extension-version>`, rejects unsupported platforms, verifies the published SHA-256, cleans partial files, and never exposes an unverified executable.
- Restricted Mode performs neither download nor CLI execution.
- Explorer command failure is distinct from absence of a Forma workspace and its bounded CLI diagnostic is available in Forma Output.
- Release CI attaches the five editor-oriented binaries and checksums in addition to existing archives and the VSIX.
- Local unit, Extension Host, package, workspace, and release workflow checks pass; one feasible remote-host smoke is recorded or its environment limitation is stated explicitly.

## Implementation Notes

- Use small reviewable commits for compatibility diagnostics, managed installation, release assets, and documentation/test closure.
- The current Alpha 16 executable is about 19 MB. Versioned storage may retain the current and immediately previous managed versions; broader cache policy is deferred.
- A checksum fetched beside the release asset matches the trust posture of the existing install scripts. Stronger signed provenance remains future distribution hardening.

## Validation Notes

- Exact extension/CLI Alpha version equality, bounded CLI stderr, and distinct Explorer load-failure presentation are implemented and covered by focused tests.
- Managed resolution preserves `forma.path`, then uses a release-aligned binary in versioned extension global storage, then falls back to Extension Host `PATH`.
- Managed installation covers the five release targets, rejects Linux musl, fixes the release tag, bounds and cancels downloads, validates asset-specific SHA-256, replaces only after verification, and cleans partial files.
- Release workflow static validation covers all five standalone assets and checksums while retaining the existing archives and avoiding `latest`.
- `mise run check` passed with the repository-pinned pnpm 11.11.0: 119 pnpm workspace tests, formatting, lint, TypeScript builds, Rust formatting/checks, and 234 Rust tests passed.
- Packaged VSIX installation and activation passed against the installed official VS Code app in a disposable profile with Forma Alpha 16.
- Restricted Mode Extension Host validation passed against the installed official VS Code app in a disposable profile without downloading or executing Forma.
- No additional Code.app was downloaded and no normal VS Code profile was modified.
- A real managed download cannot pass until the next GitHub Release publishes the new standalone assets. The downloader is covered through injected offline HTTP, checksum, size, cancellation, timeout, cleanup, and concurrency tests; the next release must verify one downloaded asset and checksum before this task moves to `done`.
- A live Remote SSH, Dev Container, or WSL host was not available. Remote placement remains supported structurally through `extensionKind: ["workspace"]` and Extension Host `globalStorageUri`, but individual remote environments remain unclaimed pending a release-backed smoke.
