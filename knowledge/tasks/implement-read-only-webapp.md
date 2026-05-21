---
scope: project
type: task
owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
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
    - "[[tasks/implement-operation-rpc-cli-foundation]]"
    - "[[tasks/implement-starter-init-create-inspect-list]]"
    - "[[tasks/implement-view-entry-render]]"
    - "[[tasks/align-view-source-query-model]]"
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

Previously blocked by operation/RPC, starter CLI flows, and render operations;
those implementation slices are now present. The task is currently blocked by
the follow-up view source/query model alignment because the WebApp should not
build its navigation and rendering surface on the older collection-bound view
model.

## Open Questions

- Component library and styling details can be chosen during implementation.
