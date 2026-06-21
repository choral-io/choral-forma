---
scope: project
type: task
priority: P0
severity:
value: H
module: api

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - config
    - paths

effort: M
status: done
readiness: ready
sprint:

blocked_by:
    - "tasks/scaffold-forma-workspace"
related_to:
    - "architecture/forma-p0-schema-dsl-spec"
    - "product/forma-p0-starter-spec"

reported_by:
affected_area: Forma configuration loading and path identity
---

# Implement Forma Config And Path Model

## Goal

Implement P0 workspace discovery, configuration loading, local override composition, and public path normalization.

## Sources

- [[product/forma-p0-starter-spec]]
- [[architecture/forma-p0-schema-dsl-spec]]
- [[architecture/forma-p0-check-index-spec]]
- [[decisions/forma-p0-core-architecture]]

## Context

Forma public contracts use workspace-relative POSIX paths. Configuration lives under `.forma/`, with optional ignored local override files loaded only through `.forma.yml` include patterns such as `.forma/local/*.yml`. `workspace.timezone` is a shared workspace setting used by time-derived runtime values.

## In Scope

- Locate and validate the workspace root.
- Load `.forma/settings.yml`, `.forma/types.yml`, and `.forma/spaces.yml`.
- Load optional included `.forma/local/*.yml` files when effective local behavior is required.
- Model `workspace.name`, `canonicalLanguage`, `supportedLanguages`, and `timezone`.
- Normalize public paths to workspace-relative POSIX strings.
- Reject absolute paths, `..` traversal, home expansion, and invalid persisted separators in workspace locators and config paths.
- Add focused unit tests for path behavior and config loading.

## Out Of Scope

- Full Schema DSL validation.
- Markdown parsing.
- Index generation.
- File creation commands.

## Acceptance Criteria

- Config loading returns typed structures and structured diagnostics.
- Optional local overrides can override supported runtime/config values without being required.
- Public JSON-facing paths never expose absolute host paths.
- Path tests cover POSIX input, Windows-style CLI input, absolute paths, traversal, case sensitivity, and invalid generated filenames.

## Relationship Notes

Blocked by workspace scaffold. Downstream work can be derived from task items whose `blocked_by` references this task, including Schema DSL/runtime values and the check/index pipeline.

## Open Questions

- Exact IANA timezone validation library can be chosen during implementation.
