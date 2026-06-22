---
scope: project
type: task
priority: P0
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - cli
    - starter

effort: L
status: done
readiness: ready
sprint:

blocked_by:
    - "tasks/implement-schema-dsl-runtime-values"
    - "tasks/implement-check-index-diagnostics"
    - "tasks/implement-operation-rpc-cli-foundation"
related_to:
    - "product/forma-p0-starter-spec"
    - "architecture/forma-p0-operation-api-spec"

reported_by:
affected_area: P0 CLI user flows
---

# Implement Starter Create Inspect List

## Goal

Implement the P0 CLI operations for using an existing configured starter workspace.

## Sources

- [[product/forma-p0-starter-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-check-index-spec]]

## Context

P0 should provide enough CLI behavior to create entries, inspect entries, list a space, and check the workspace through the shared in-memory discovery pipeline. Workspace initialization has been removed from the current CLI surface and should be redesigned separately before it returns.

## In Scope

- Implement `forma create <space> [--input <name=value>]... [--json]`.
- Implement `forma inspect <path> [--json]` and `forma inspect --space <space> <entry> [--json]`.
- Implement `forma list --space <space> [--json]`.
- Wire `forma check` to the shared in-memory discovery and diagnostic operations without writing persistent index artifacts.
- Add CLI tests for success cases, no persistent index writes, path conflicts, invalid inputs, and JSON output.

## Out Of Scope

- Structured metadata edit commands such as `set`, `add`, `remove`, and `unset`.
- Search/query commands.
- Deprecate, delete, move, rename, or fix commands.
- WebApp UI.

## Acceptance Criteria

- `forma create` writes one file from space inputs and template without creating or requiring a persistent index artifact.
- Inspect and list commands return stable JSON and useful human output.
- Warnings exit zero and errors exit non-zero according to the P0 operation spec.

## Relationship Notes

Previously blocked by Schema DSL/runtime values, check/index diagnostics, and operation dispatch foundation; all prerequisites are now done.

## Follow-up Notes

Workspace initialization is intentionally not part of the current CLI surface. Starter work should use the committed starter-kit or explicit test fixtures until a redesigned initialization flow is accepted.
