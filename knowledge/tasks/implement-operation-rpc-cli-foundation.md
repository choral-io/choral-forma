---
scope: project
type: task
priority: P0
severity:
value: H
module: api

owners:
    - "members/Tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - cli
    - rpc

effort: M
status: done
readiness: ready
sprint:

blocked_by:
    - "tasks/scaffold-forma-workspace"
related_to:
    - "architecture/forma-p0-operation-api-spec"

reported_by:
affected_area: Operation dispatch, CLI, and local HTTP RPC
---

# Implement Operation RPC CLI Foundation

## Goal

Implement the typed operation dispatcher, CLI JSON behavior, and minimal JSON-RPC HTTP foundation for P0.

## Sources

- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-core-technical-direction]]
- [[decisions/forma-p0-core-architecture]]

## Context

CLI, local HTTP API, future MCP, and future editor integrations should call the same operation model. P0 local HTTP uses a strict minimal JSON-RPC 2.0 shape.

## In Scope

- Define typed operation request/result/error structures.
- Route CLI handlers through the shared dispatcher.
- Implement direct JSON output for CLI `--json`.
- Implement `POST /rpc` with minimal strict JSON-RPC 2.0 request/response behavior.
- Distinguish workspace diagnostics from JSON-RPC transport/protocol errors.
- Add tests for JSON-RPC parse errors, invalid requests, invalid params, unknown methods, and successful dispatch.

## Out Of Scope

- MCP, stdio JSON-RPC, batch requests, notifications, subscriptions, or server push.
- Full product operation implementations beyond stub dispatch wiring.
- Parallel REST endpoints for product operations.

## Acceptance Criteria

- CLI JSON outputs direct operation result objects with `schemaVersion`.
- HTTP RPC success and error envelopes follow JSON-RPC 2.0 shapes.
- Product operations can be registered without duplicating adapter semantics.
- Protocol errors use standard JSON-RPC error codes and Forma-specific codes in `error.data`.

## Relationship Notes

Blocked by workspace scaffold. Product commands can be wired after core operation implementations are available.

## Open Questions

- None.
