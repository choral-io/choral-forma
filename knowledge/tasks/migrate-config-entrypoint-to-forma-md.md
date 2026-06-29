---
schemaVersion: 1
kind: task
scope: project
title: "Migrate Config Entrypoint To Forma Md"
summary: "Replace the `.forma.yml` workspace entrypoint with Markdown-native `.forma.md` before public release."
type: task
priority: P0
value: H
module: core
effort: M
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers:
    - "members/tiscs"
tags:
    - forma
    - configuration
    - markdown
    - cli
blockedBy: []
relatedTo:
    - "decisions/use-markdown-workspace-entrypoint"
    - "architecture/forma-core-technical-direction"
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: "Forma config loader, init, docs, starter kit, project knowledge workspace"
---

# Migrate Config Entrypoint To Forma Md

## Goal

Make `.forma.md` the only Forma workspace entrypoint and remove runtime, docs, starter-kit, and project-knowledge assumptions that `.forma.yml` exists.

## Sources

- [[decisions/use-markdown-workspace-entrypoint]]
- [[architecture/forma-core-technical-direction]]
- [[tasks/implement-docs-backed-init-and-agent-onboarding]]

## In Scope

- Change runtime entrypoint discovery and source reporting to `.forma.md`.
- Parse `.forma.md` frontmatter as the root workspace configuration.
- Update `forma init` to write `.forma.md`.
- Migrate this repository and `examples/getting-started-workspace` to `.forma.md`.
- Update docs, embedded Agent guidance, tests, and knowledge references.
- Verify CLI, RPC, starter-kit, project knowledge, and full checks.

## Out Of Scope

- Automatic migration from `.forma.yml`.
- Dual-entrypoint fallback.
- Profile overlay implementation.
- Removing explicitly included YAML config fragments.

## Acceptance Criteria

- `.forma.yml` is not used as a runtime entrypoint.
- `forma init` writes `.forma.md` and no `.forma.yml`.
- `config inspect` reports `.forma.md` as the root source.
- The project knowledge workspace passes `forma check` and `workspace health`.
- The starter kit passes `forma check` and `workspace health`.
- Rust CLI/core/RPC tests pass.
- Product docs and Agent guidance describe `.forma.md` only.
