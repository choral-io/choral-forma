---
scope: project
type: task
priority: P0
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - schema
    - workspace
    - migration

effort: M
status: done
readiness: ready
sprint:

blocked_by: []
related_to:
    - "architecture/repository-forma-workspace-migration-design"
    - "tasks/migrate-repository-knowledge-to-forma-workspace"

reported_by:
affected_area: Forma space schema loading and graph field relations
---

# Load User Authored Space Schemas

## Goal

Load and validate schema definitions from `.forma/spaces/*.md` so repository migration can express task, member, planning, and knowledge relationship fields as Forma Schema DSL instead of relying on built-in starter schemas.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[architecture/forma-p0-schema-dsl-spec]]
- [[architecture/forma-view-query-model]]
- [[tasks/migrate-repository-knowledge-to-forma-workspace]]

## In Scope

- Parse user-authored `schema` frontmatter from space definition files.
- Preserve existing starter fallback behavior only where no schema is configured.
- Validate configured schema fields with existing Schema DSL diagnostics.
- Make schema-declared `ref` fields available to indexing and graph field edge rendering.

## Out of Scope

- Migrating repository content.
- Adding write-capable repair operations.
- Implementing MCP.
- Supporting JSON Schema as the user-authored schema format.

## Acceptance Criteria

- A space file can define a `schema` object in frontmatter and have it drive entry validation.
- Existing starter workspaces without explicit schemas continue to load.
- Graph views can render `source: fields` edges from schema-declared reference fields.
- Focused tests cover schema loading, fallback behavior, and at least one field-relation graph edge.

## Implementation Notes

- `crates/forma-core/src/config.rs` now prefers user-authored `schema` frontmatter from space definition files.
- Spaces without an explicit `schema` still use the existing starter fallback schema.
- `crates/forma-core/src/render.rs` has a graph rendering regression test that proves a custom `project` reference field from a user-authored space schema can produce a configured `source: fields` edge.

## Review Readiness

| Field | Evidence |
| --- | --- |
| Scope completed | User-authored space schemas load into runtime config; fallback behavior is preserved; schema-declared ref fields can drive graph field edges. |
| Files changed | `crates/forma-core/src/config.rs`, `crates/forma-core/src/render.rs`, and this task. |
| Knowledge updated | Yes: this task records implementation notes and review evidence. |
| Checks run | `cargo test`, Prettier check for changed knowledge files, `forma check --json`, `forma config inspect --json`, `forma tasks list --json`, and `forma knowledge health --json` passed or returned the existing accepted health warning baseline. |
| Residual risks | Existing repository task metadata still uses wikilink strings; enabling stricter ref schemas for the real repository spaces should wait for content migration/normalization. |
| Suggested review | Verify the schema-loading fallback path and the custom field-relation graph test. |
