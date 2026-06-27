---
schemaVersion: 1
kind: task
scope: project
title: Generalize Task-Specific Read Operations
summary: Replace task-specific CLI and RPC read APIs with space/schema-driven operations so Forma does not treat tasks as a core concept.
type: task
priority: P2
value: M
module: core
effort: M
status: doing
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - api
    - content-model
blockedBy: []
relatedTo:
    - "product/product-direction"
    - "architecture/forma-p0-operation-api-spec"
    - "tasks/design-reviewable-forma-write-operations"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: CLI and RPC operation model
---

# Generalize Task-Specific Read Operations

## Goal

Replace task-specific CLI and RPC read APIs with generic, space/schema-driven operations so Forma does not treat tasks as a built-in content type.

## Context

Forma's product model is a Markdown-backed content workspace. Content categories such as tasks, members, notes, or guidelines are configured spaces, not core ontology.

Forma previously exposed task-specialized surfaces such as `tasks.list`, `tasks.inspect`, and `board.show`. They were useful for the repository's dogfooding workflow, but their names implied that `task` was a built-in Forma concept.

## In Scope

- Review the previous `tasks.*` and `board.show` CLI/RPC surfaces.
- Define equivalent generic read operations in terms of configured spaces, views, schemas, or query projections.
- Decide whether task-specific aliases should be removed, renamed, or kept temporarily as project-workspace conveniences before the next internal release.
- Update built-in Agent guidance after the generic operations exist.
- Preserve the ability for this repository's configured `tasks` space to support task selection and board review through configuration rather than product assumptions.

## Out of Scope

- Implementing write operations.
- Designing task transition policies.
- Removing the repository's configured `tasks` space.
- Changing starter-kit content unless it is needed to demonstrate the generic operation shape.

## Acceptance Criteria

- Forma has a documented generic replacement path for `tasks.list`, `tasks.inspect`, and `board.show`.
- Product-facing docs and built-in skills no longer present `task` as a core Forma concept.
- The repository dogfooding workflow can still inspect configured task-like content through generic operations.

## Progress

- Added `forma view render <view-id-or-path> --json` as the generic CLI path for configured list, table, kanban, and graph projections.
- Updated Agent-facing guidance to use `list --space`, `inspect`, and `view render` for read workflows.
- Removed the public `forma tasks ...` and `forma board show` CLI helpers so the CLI no longer presents task-like content as a built-in product concept.
- Removed legacy RPC/core `tasks.list`, `tasks.inspect`, and `board.show` operations. Generic `list`, `inspect`, and `view.render` now cover configured task-like workflows.
