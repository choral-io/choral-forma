---
schemaVersion: 1
scope: project
type: task
title: Add VS Code Forma LSP Lifecycle
summary: Add a dormant single-active-root VS Code Language Client lifecycle that reuses the trusted release-aligned Forma CLI and supports local and remote URI conversion.
priority: P1
value: H
module: app
effort: M
status: backlog
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - lsp
    - lifecycle
    - remote
blockedBy:
    - "tasks/normalize-forma-lsp-client-profiles"
relatedTo:
    - "planning/vscode-lsp-navigation-migration-plan"
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "tasks/manage-vscode-forma-cli-lifecycle"
    - "tasks/implement-vscode-forma-workspace-foundation"
severity:
sprint:
reportedBy:
affectedArea: VS Code extension Forma Language Client process, trust, root, and URI lifecycle
---

# Add VS Code Forma LSP Lifecycle

## Goal

Prepare a safe VS Code Language Client lifecycle without changing user-facing navigation until lifecycle, trust, version, root, URI, and cleanup behavior are independently verified.

## Sources

- [[planning/vscode-lsp-navigation-migration-plan]]
- [[architecture/editor-extension-adapter-contract]]
- [[architecture/forma-performance-engineering]]
- [[tasks/manage-vscode-forma-cli-lifecycle]]
- [[tasks/implement-vscode-forma-workspace-foundation]]

## In Scope

- Add the Microsoft VS Code Language Client as a bundled runtime dependency through `mise exec -- pnpm` and update the lockfile deterministically.
- Refactor the existing Forma runtime to expose the resolved exact-version command and active root as one internal ready context.
- Reuse existing explicit-path, managed-installation, Extension Host `PATH`, version-probe, Workspace Trust, and error-reporting behavior.
- Add a lifecycle manager that can start, stop, restart, switch root, cancel startup, report state, and dispose one `forma --workspace <root> lsp` process.
- Keep at most one active-root server and stop it before switching to a different root.
- Configure client URI converters between `vscode-remote:` editor URIs and Extension Host-visible `file:` protocol URIs.
- Handle initialization failure, unexpected exit, bounded restart, root removal, configuration changes, trust changes, extension deactivation, and incompatible CLI transitions.
- Add unit tests for command construction, client options, selector scope, URI round trips, state transitions, restart bounds, and disposal.
- Record extension bundle and package-size deltas.
- Keep the lifecycle dormant in production activation until the navigation migration task enables it.

## Out Of Scope

- Registering LSP Definition or DocumentLink for users.
- Running one server per discovered root.
- Replacing the existing CLI downloader, command client, Preview, Explorer, health, or View rendering.
- Adding a user setting that exposes internal client-profile selection.
- Hover, Diagnostics, Completion, References, Rename, or write operations.

## Acceptance Criteria

- No Forma LSP process starts outside a trusted ready workspace with an exact matching CLI.
- The lifecycle uses the same command source and active root as structured CLI operations and introduces no second binary-management path.
- Switching roots and disposing the extension leave no orphan process, watcher, timer, output handler, or stale state.
- URI conversion keeps local and remote document and target paths inside the selected workspace and round-trips deterministically.
- Unexpected exit follows a bounded restart policy and produces actionable output without a restart storm.
- The dormant manager does not add a second Definition or DocumentLink provider or otherwise change current navigation.
- Bundle and VSIX size changes are recorded and reviewed if material.
- Focused VS Code tests and `mise run check` pass.
