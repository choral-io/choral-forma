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
status: done
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
- Automatically migrating arbitrary old YAML config fragments.

## Acceptance Criteria

- `.forma.yml` is not used as a runtime entrypoint.
- `forma init` writes `.forma.md` and no `.forma.yml`.
- `config inspect` reports `.forma.md` as the root source.
- The project knowledge workspace passes `forma check` and `workspace health`.
- The starter kit passes `forma check` and `workspace health`.
- Rust CLI/core/RPC tests pass.
- Product docs and Agent guidance describe `.forma.md` only.

## Completion Evidence

- Current product code, docs, examples, skills, and workflow guidance contain no active `.forma.yml` entrypoint references; the remaining occurrences are regression tests that prove `forma init` ignores and preserves a legacy file.
- `forma config inspect --json` and `forma check --json` pass for both this repository and `examples/getting-started-workspace` with zero errors.
- `forma workspace health --json` completes for both workspaces with zero errors; only existing no-backlink warnings remain.
- Focused `forma init` coverage passed all three init tests, including minimal bootstrap, non-overwrite behavior, and legacy `.forma.yml` isolation.
- `mise run check` passed on 2026-07-17 across pnpm, Rust, and the Zed WASM target.
