---
scope: project
type: task
owners:
  - "[[groups/default-team]]"
assignees: []
reviewers:
  - "[[groups/default-team]]"
tags:
  - forma
  - p0
  - webapp
priority: P0
severity:
value: M
module: app
effort: L
readiness: blocked
sprint:
blocked_by:
  - "[[tasks/items/implement-operation-rpc-cli-foundation]]"
  - "[[tasks/items/implement-starter-init-create-inspect-list]]"
  - "[[tasks/items/implement-view-entry-render]]"
related_to:
  - "[[architecture/forma-p0-operation-api-spec]]"
  - "[[decisions/forma-p0-core-architecture]]"
reported_by:
affected_area: Local read-only Forma WebApp
---

# Implement Read Only WebApp

## Goal

Implement the P0 local read-only WebApp served by `forma serve`.

## Sources

- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-p0-operation-api-spec]]
- [[product/forma-p0-starter-spec]]

## Context

The P0 GUI is a local browser WebApp backed by `POST /rpc`. It should provide
basic browsing and rendering, but no editing or mutation.

## In Scope

- Implement WebApp shell in `packages/webapp`.
- Implement shared RPC client/types/utilities in `packages/shared`.
- Show workspace overview from composed operations.
- Show collections, entry lists, entry inspection/rendering, page views, check
  diagnostics, and index status.
- Serve built static assets from `forma serve` in release mode.
- Add frontend type/build checks and minimal integration tests where practical.

## Out Of Scope

- Editing, create forms, drag/drop, or configuration mutation in the GUI.
- Desktop or mobile clients.
- VS Code or Zed extensions.
- MCP integration.

## Acceptance Criteria

- `forma serve` starts a localhost server and serves the WebApp.
- The WebApp uses RPC operations instead of direct file reads.
- Starter workspace collections and views are browsable.
- Diagnostics and stale-index state are visible without being persisted.
- Frontend build/type checks pass in CI.

## Relationship Notes

Blocked by operation/RPC, starter CLI flows, and render operations.

## Open Questions

- Component library and styling details can be chosen during implementation.
