---
scope: project
type: task
priority: P2
severity:
value: M
module: app

owners:
    - "members/Tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p2
    - editor-extension
    - vscode
    - zed

effort: M
status: backlog
readiness: needs-refinement
sprint:

blocked_by:
    - "tasks/implement-webapp-v2-dashboard-shell"
related_to:
    - "decisions/webapp-primary-gui-client"
    - "planning/webapp-primary-gui-roadmap"
    - "tasks/implement-vscode-extension-mvp"
    - "tasks/implement-zed-extension-mvp"

reported_by:
affected_area: Editor extension adapter contract
---

# Design Editor Extension Adapter Contract

## Goal

Design the shared adapter contract that future VS Code and Zed extensions should use to connect editor context to the Forma local service and primary WebApp.

## Sources

- [[decisions/webapp-primary-gui-client]]
- [[planning/webapp-primary-gui-roadmap]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

Editor extensions are no longer the P1 main product surface. They should become thin adapters after the WebApp GUI and shared operation contracts stabilize. Designing the adapter contract first avoids duplicating GUI logic separately in VS Code and Zed.

## In Scope

- Define editor extension responsibilities and non-responsibilities.
- Define how an editor extension locates, starts, or connects to `forma serve`.
- Define how current workspace and current file context are sent to the WebApp or shared operations.
- Define status, diagnostics, command palette, and open-in-WebApp behavior.
- Identify shared TypeScript or RPC client reuse opportunities.
- Split VS Code and Zed implementation follow-ups.

## Out Of Scope

- Implementing either extension.
- Recreating the WebApp UI inside editor sidebars.
- Direct file rewrites from editor extension commands.
- Marketplace packaging or publishing policy.

## Acceptance Criteria

- The adapter contract states what functionality belongs in extensions versus the WebApp.
- VS Code and Zed MVP tasks can share the same behavior model.
- Required RPC/CLI capabilities are listed.
- Security, workspace-root, and local service lifecycle boundaries are explicit.

## Relationship Notes

This task should stay behind the WebApp V2 dashboard shell and primary GUI client work. It prepares editor extension implementation without making extensions the main product path.

## Open Questions

- Should extensions launch `forma serve` themselves, or only connect to an already-running local service in the MVP?
