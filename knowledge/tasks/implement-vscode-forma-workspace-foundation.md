---
schemaVersion: 1
kind: task
scope: project
title: Implement VS Code Forma workspace foundation
summary: Discover .forma.md roots and expose trusted, remote-compatible workspace lifecycle, status, commands, refresh, and output behavior.
type: task
priority: P1
value: H
module: app
effort: L
status: backlog
readiness: blocked
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - workspace
    - trust
blockedBy:
    - "tasks/implement-editor-extension-forma-command-client"
relatedTo:
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code workspace discovery and foundation UX
---

# Implement VS Code Forma Workspace Foundation

## Goal

Turn the command client into a safe, understandable Forma workspace experience before adding navigation or previews.

## Sources

- [[architecture/editor-extension-adapter-contract]]
- [[design/editor-extension-mvp-design]]
- [[planning/editor-extension-alpha-13-execution-plan]]

## In Scope

- Discover `.forma.md` at workspace-folder roots and as the nearest ancestor of an active Markdown document within the folder boundary.
- Support multiple discovered roots in VS Code multi-root workspaces and select the root applicable to the active document.
- Call `config.inspect` before treating a candidate root as ready.
- Watch relevant config changes and cancel or supersede stale refreshes.
- Model no-workspace, restricted, binary-missing, incompatible, invalid-config, checking, warning, failed, and ready states.
- Add the Forma status bar item, Output Channel, and Select Workspace, Inspect Configuration, Check Workspace, Refresh Workspace, and Open Output commands.
- Respect Workspace Trust at both manifest and runtime boundaries; reinitialize safe capabilities after trust is granted.
- Use workspace-extension placement so Forma executes beside local or remote workspace files.
- Handle unsupported virtual workspaces with a clear explanation.

## Out Of Scope

- Reference providers.
- View preview or WebViews.
- Full remote-platform test matrix.
- Writable workspace commands.

## Acceptance Criteria

- Root, nested, no-config, invalid, and multi-root discovery cases are covered by tests.
- Status and commands map deterministically from runtime state.
- Untrusted workspaces cannot execute configurable workspace binaries or Forma operations.
- Local workspace integration tests pass.
- The extension structure is compatible with remote workspace hosts and one feasible remote smoke is recorded when the local environment permits it.
- Remote SSH, Dev Containers, and WSL are not individually claimed as fully validated unless evidence exists.
