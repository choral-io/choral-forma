---
scope: project
type: task
priority: P0
severity:
value: H
module: api

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - schema
    - runtime-values

effort: M
readiness: ready
sprint:

blocked_by:
    - "[[tasks/implement-forma-config-and-path-model]]"
related_to:
    - "[[architecture/forma-p0-schema-dsl-spec]]"

reported_by:
affected_area: Schema validation and create input resolution
---

# Implement Schema DSL Runtime Values

## Goal

Implement the P0 Forma Schema DSL, semantic types, placeholder resolution, `slugify`, and runtime value providers.

## Sources

- [[architecture/forma-p0-schema-dsl-spec]]
- [[product/forma-p0-starter-spec]]
- [[product/product-direction]]

## Context

The Schema DSL is the P0 user-authored object constraint language. Runtime values are explicit `runtime.values.*` definitions, and current-user behavior is modeled as a normal runtime value.

## In Scope

- Implement Schema DSL node types: `object`, `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `const`, `enum`, `ref`, and `list`.
- Implement field-local `required: true`, `readonly`, and `hidden` hints.
- Implement semantic types for static enums and space-backed references.
- Implement simple `{{ path.to.value }}` placeholder resolution with cycle detection.
- Implement `slugify` transform.
- Implement runtime providers: `const`, `gitConfig`, `currentDate`, `currentDateTime`, and `workspaceRoot`.
- Make `currentDate` and `currentDateTime` use effective `workspace.timezone`.
- Add tests for defaults, transforms, dependency resolution, cycles, and unresolved required runtime values.

## Out Of Scope

- JSON Schema authoring files.
- Custom validators, executable plugins, or script hooks.
- Union reference types, groups, lifecycle/deprecation, maps, or polymorphic object schemas.

## Acceptance Criteria

- Valid P0 starter space schemas parse and validate.
- Invalid enum, ref, required, and type cases produce structured diagnostics.
- Runtime values can be resolved from shared config and local overrides.
- Placeholder cycles and missing required dependencies produce diagnostics.
- `slugify` handles whitespace, reserved path characters, empty output, and Windows reserved names.

## Relationship Notes

Blocked by config/path model. Downstream work can be derived from task items whose `blocked_by` references this task, including check/index and starter create flows.

## Follow-up Notes

`date` and `datetime` lexical formats were fixed during implementation: persisted `date` values use `YYYY-MM-DD`, and persisted `datetime` values use RFC3339 with explicit `Z` or numeric offset.
