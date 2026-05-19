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
  - workspace
priority: P0
severity:
value: H
module: infra
effort: M
readiness: ready
sprint:
blocked_by: []
related_to:
  - "[[decisions/forma-p0-core-architecture]]"
  - "[[architecture/forma-core-technical-direction]]"
unblocks:
  - "[[tasks/items/implement-forma-config-and-path-model]]"
  - "[[tasks/items/implement-operation-rpc-cli-foundation]]"
  - "[[tasks/items/implement-markdown-forma-ast-parser]]"
reported_by:
affected_area: P0 workspace foundation
---

# Scaffold Forma Workspace

## Goal

Create the initial Rust and web monorepo scaffold for Choral Forma P0.

## Sources

- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

P0 should use a single `forma` binary backed by a Rust workspace and a
development-time TypeScript WebApp workspace. The scaffold should establish
module boundaries without implementing product behavior yet.

## In Scope

- Create root Rust workspace with `crates/forma-core`, `crates/forma-rpc`, and
  `crates/forma-cli`.
- Create root web workspace with `packages/webapp` and `packages/shared`.
- Add root package manager metadata, lockfiles, Rust toolchain metadata, and
  mise tasks needed for format, check, test, and build.
- Add placeholder library/binary entry points that compile.
- Document the current local build and check commands in repository guidance.

## Out Of Scope

- Implement Forma product operations.
- Implement the WebApp UI beyond a placeholder that can build.
- Add release packaging or installer scripts.

## Acceptance Criteria

- `cargo test` passes for the scaffold.
- Web workspace install and build commands are documented and pass locally.
- `mise run check:knowledge` still passes.
- The scaffold follows the crate/package names and responsibilities in the
  accepted architecture decision.

## Relationship Notes

This is the first implementation task. It unblocks core engine, parser, RPC,
and later WebApp work.

## Open Questions

- None.
