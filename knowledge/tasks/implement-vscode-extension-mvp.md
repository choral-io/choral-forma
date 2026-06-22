---
scope: project
type: task
priority: P2
severity:
value: M
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p2
    - vscode
    - editor-extension

effort: M
status: backlog
readiness: blocked
sprint:

blockedBy:
    - "tasks/design-editor-extension-adapter-contract"
relatedTo:
    - "decisions/webapp-primary-gui-client"
    - "planning/webapp-primary-gui-roadmap"
    - "tasks/implement-zed-extension-mvp"

reportedBy:
affectedArea: VS Code extension
---

# Implement VS Code Extension MVP

## Goal

Implement a thin VS Code adapter for Forma after the editor extension adapter contract is accepted.

## Sources

- [[decisions/webapp-primary-gui-client]]
- [[planning/webapp-primary-gui-roadmap]]
- [[tasks/design-editor-extension-adapter-contract]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

VS Code is the first editor extension target because the repository already has VS Code/Foam-oriented Markdown integration. The extension should not duplicate the WebApp. It should bridge the editor workspace and current file into the Forma local service and primary GUI.

## In Scope

- Add a VS Code extension workspace/package scaffold when the adapter contract is ready.
- Connect to or launch the Forma local service according to the accepted adapter contract.
- Provide commands to open the WebApp for the current workspace and current file.
- Show Forma status and diagnostics at a minimal level.
- Reuse shared operation/RPC types where practical.
- Add focused extension build/type checks.

## Out Of Scope

- Recreating the WebApp interface inside VS Code.
- Full Markdown editing features.
- Direct file mutation commands.
- Zed extension implementation.
- Marketplace publishing.

## Acceptance Criteria

- The VS Code extension can connect a workspace to Forma according to the accepted adapter contract.
- Users can open the primary WebApp from VS Code.
- Current file context can be passed to WebApp-backed workflows when supported.
- Extension checks pass.
- The implementation does not duplicate core Forma semantics.

## Relationship Notes

This task is intentionally blocked until the adapter contract exists.

## Open Questions

-
