---
scope: project
type: task
priority: P2
severity:
value: L
module: app

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p2
    - zed
    - editor-extension

effort: M
readiness: blocked
sprint:

blocked_by:
    - "[[tasks/design-editor-extension-adapter-contract]]"
    - "[[tasks/implement-vscode-extension-mvp]]"
related_to:
    - "[[decisions/webapp-primary-gui-client]]"
    - "[[planning/webapp-primary-gui-roadmap]]"

reported_by:
affected_area: Zed extension
---

# Implement Zed Extension MVP

## Goal

Implement a thin Zed adapter for Forma after the shared editor adapter contract
and VS Code MVP validate the extension model.

## Sources

- [[decisions/webapp-primary-gui-client]]
- [[planning/webapp-primary-gui-roadmap]]
- [[tasks/design-editor-extension-adapter-contract]]
- [[tasks/implement-vscode-extension-mvp]]

## Context

Zed is an important editor target, but it should follow the primary WebApp GUI
work and the first VS Code adapter. The Zed extension should reuse the same
behavior model instead of becoming a separate product surface.

## In Scope

- Add a Zed extension scaffold when the adapter contract and VS Code MVP provide
  a proven baseline.
- Connect to the Forma local service according to the accepted adapter contract.
- Provide commands to open the WebApp for the current workspace and current
  file.
- Show minimal Forma status and diagnostics where Zed APIs allow.
- Add focused extension build/type checks.

## Out Of Scope

- Recreating the WebApp interface inside Zed.
- Full Markdown editing features.
- Direct file mutation commands.
- VS Code extension implementation.
- Extension marketplace publishing.

## Acceptance Criteria

- The Zed extension can connect a workspace to Forma according to the accepted
  adapter contract.
- Users can open the primary WebApp from Zed.
- Current file context can be passed to WebApp-backed workflows when supported.
- Extension checks pass.
- The implementation does not duplicate core Forma semantics.

## Relationship Notes

This task is blocked behind the shared adapter contract and the VS Code MVP so
the second editor adapter can reuse the same product boundary.

## Open Questions

-
