---
name: forma-cli
description: Use for project-local Forma workspace operations and agent-facing read workflows through the local `forma` binary.
---

# Forma CLI Agent Entrypoint

## Role

Project-local router for Forma workspace operations. Do not assume repository layout, guideline paths, or space ids beyond `forma config inspect` and operation output.

## Bootstrap

Run commands from the target workspace root. If cwd is uncertain, pass `--workspace <path>`.

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- workspace health --json`

Use `skills list --json` and `skills get <skill-id>` only when the request matches a workspace-projected workflow. For empty workspace setup, follow `forma-cli-core` and load `agents.workspace-bootstrap` only when needed.

## Read Commands

- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- skills list --json`
- `cargo run -q -p forma-cli -- skills get <skill-id>`
- `cargo run -q -p forma-cli -- workspace health --json`
- `cargo run -q -p forma-cli -- list --space <space-id> --json`
- `cargo run -q -p forma-cli -- inspect <path> --json`
- `cargo run -q -p forma-cli -- inspect --space <space-id> <entry-id> --json`
- `cargo run -q -p forma-cli -- view render <view-id-or-path> --json`

Use `--json` in machine-facing checks and for any operation that will feed review notes.

`tasks.*` and `board show` are current helpers for this repository's configured task-like workflow, not core Forma content types. Prefer generic `list --space`, `inspect`, and `view render` when sufficient.

## Write Boundary

- Do not modify shared content, task metadata, board state, Forma config, guidelines, or repository operating state without explicit user approval.
- Before target-specific edits, inspect the target and read returned `guidelines`.
- After approved writes, run `cargo run -q -p forma-cli -- check --json` and `cargo run -q -p forma-cli -- workspace health --json`.

## Local-Only Boundary

Do not commit local-only state. Determine local-only paths from configured guidelines, repository instructions, and Forma config instead of hard-coding repository layout in this Skill.
