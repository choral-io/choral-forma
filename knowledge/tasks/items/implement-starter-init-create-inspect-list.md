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
  - cli
  - starter
priority: P0
severity:
value: H
module: app
effort: L
readiness: ready
sprint:
blocked_by:
  - "[[tasks/items/implement-schema-dsl-runtime-values]]"
  - "[[tasks/items/implement-check-index-diagnostics]]"
  - "[[tasks/items/implement-operation-rpc-cli-foundation]]"
related_to:
  - "[[product/forma-p0-starter-spec]]"
  - "[[architecture/forma-p0-operation-api-spec]]"
reported_by:
affected_area: P0 CLI user flows
---

# Implement Starter Init Create Inspect List

## Goal

Implement the P0 CLI operations for initializing and using the minimal starter
workspace.

## Sources

- [[product/forma-p0-starter-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-check-index-spec]]

## Context

P0 should provide enough CLI behavior to create a workspace, create entries,
inspect entries, list a collection, check the workspace, and rebuild/check the
summary index.

## In Scope

- Implement
  `forma init --name <name> [--language <tag>] [--timezone <iana>] [-y|--yes]`.
- Generate the P0 starter `.forma/` files, templates, views, content
  directories, `.forma/.gitignore`, and initial summary index.
- Store explicit `workspace.timezone`, defaulting from the current environment
  when no timezone input is provided.
- Require explicit confirmation before `init` writes files unless `-y` or
  `--yes` is provided; non-interactive shells should fail without writing files
  unless confirmation is bypassed explicitly.
- Implement `forma create <collection> [--input <name=value>]... [--json]`.
- Implement `forma inspect <path> [--json]` and
  `forma inspect --collection <collection> <entry> [--json]`.
- Implement `forma list --collection <collection> [--json]`.
- Wire `forma check`, `forma index rebuild`, and `forma index check` to the
  shared operations.
- Add CLI tests for success cases, stale index warnings, path conflicts,
  invalid inputs, and JSON output.

## Out Of Scope

- Structured metadata edit commands such as `set`, `add`, `remove`, and
  `unset`.
- Search/query commands.
- Deprecate, delete, move, rename, or fix commands.
- WebApp UI.

## Acceptance Criteria

- `forma init` creates the exact P0 starter shape and fails when `.forma/`
  already exists.
- `forma init` shows resolved init parameters and requires confirmation before
  writing in interactive shells; non-interactive usage requires `-y` or `--yes`.
- `forma create` writes one file from collection inputs and template, then
  reports stale index without rebuilding automatically.
- Inspect and list commands return stable JSON and useful human output.
- Warnings exit zero and errors exit non-zero according to the P0 operation
  spec.

## Relationship Notes

Previously blocked by Schema DSL/runtime values, check/index diagnostics, and
operation dispatch foundation; all prerequisites are now done.

## Follow-up Notes

`forma init` exposes `--timezone` as an optional override. When omitted, the
implementation detects the current environment timezone once and writes the
resolved value into `.forma/workspace.yml`.
