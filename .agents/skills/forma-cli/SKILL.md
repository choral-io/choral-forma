---
name: forma-cli
description: Use for project-local Forma knowledge operations and agent-facing read workflows through the local `forma` binary.
---

# Forma CLI Agent Entrypoint

## Scope

This skill is the project-local replacement for prior Knowledge Workflow read/audit/status/task-selection/review-prep entrypoints when working in this repository.

Use it for:

- workflow bootstrap checks;
- shared knowledge health review;
- task inventory and task-card inspection;
- board review for delivery state;
- read-only review prep and evidence collection.

## Bootstrap (required before knowledge workflow actions)

Run both:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`

Add `--workspace <path>` when operating on a non-default workspace.

## Read Commands

- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- knowledge health --json`
- `cargo run -q -p forma-cli -- tasks list --json`
- `cargo run -q -p forma-cli -- tasks inspect --json <task-id-or-path>`
- `cargo run -q -p forma-cli -- board show --json`
- `cargo run -q -p forma-cli -- list --space <space-id> --json`
- `cargo run -q -p forma-cli -- inspect --space <space-id> <path-or-id> --json`

Use `--json` in machine-facing checks and for any operation that will feed review notes.

## Write Boundary

- Do not modify shared knowledge, task metadata, board state, `.forma.yml`, `.forma/spaces/**/*.md`, or workflow state unless the user gives explicit approval.
- This skill prefers read-only operation; any requested write should be routed through the owning repository workflow process after explicit approval.

## Local-Only Boundary

Do not commit:

- `knowledge/workspace/*/local/`
- `.agents/*/local`
- `.worktrees/`
- `.forma/local.yml`
- generated caches (including `target/`, `node_modules/`, and tool caches).

## Direct Markdown Edits

When the user asks for repository knowledge updates:

1. Edit shared Markdown in an explicit file.
2. Verify with `cargo run -q -p forma-cli -- check --json`.
3. Verify health with `cargo run -q -p forma-cli -- knowledge health --json`.
4. If the user asked for review prep, add concise review evidence from the commands above and report the resulting status.
