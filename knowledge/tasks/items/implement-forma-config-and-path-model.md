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
  - config
  - paths
priority: P0
severity:
value: H
module: api
effort: M
readiness: ready
sprint:
blocked_by: []
related_to:
  - "[[architecture/forma-p0-schema-dsl-spec]]"
  - "[[product/forma-p0-starter-spec]]"
unblocks:
  - "[[tasks/items/implement-schema-dsl-runtime-values]]"
  - "[[tasks/items/implement-check-index-diagnostics]]"
reported_by:
affected_area: Forma configuration loading and path identity
---

# Implement Forma Config And Path Model

## Goal

Implement P0 workspace discovery, configuration loading, local override
composition, and public path normalization.

## Sources

- [[product/forma-p0-starter-spec]]
- [[architecture/forma-p0-schema-dsl-spec]]
- [[architecture/forma-p0-check-index-spec]]
- [[decisions/forma-p0-core-architecture]]

## Context

Forma public contracts use workspace-relative POSIX paths. Configuration lives
under `.forma/`, with `.forma/overrides/local.yml` as the optional ignored
local override file. `workspace.timezone` is a shared workspace setting used by
time-derived runtime values.

## In Scope

- Locate and validate the workspace root.
- Load `.forma/workspace.yml`, `.forma/types.yml`, and
  `.forma/collections.yml`.
- Load optional `.forma/overrides/local.yml` when effective local behavior is
  required.
- Model `workspace.name`, `canonicalLanguage`, `supportedLanguages`, and
  `timezone`.
- Normalize public paths to workspace-relative POSIX strings.
- Reject absolute paths, `..` traversal, home expansion, and invalid persisted
  separators in workspace locators and config paths.
- Add focused unit tests for path behavior and config loading.

## Out Of Scope

- Full Schema DSL validation.
- Markdown parsing.
- Index generation.
- File creation commands.

## Acceptance Criteria

- Config loading returns typed structures and structured diagnostics.
- Optional local overrides can override supported runtime/config values without
  being required.
- Public JSON-facing paths never expose absolute host paths.
- Path tests cover POSIX input, Windows-style CLI input, absolute paths,
  traversal, case sensitivity, and invalid generated filenames.

## Relationship Notes

Blocked by workspace scaffold. Unblocks Schema DSL/runtime values and the
check/index pipeline.

## Open Questions

- Exact IANA timezone validation library can be chosen during implementation.
