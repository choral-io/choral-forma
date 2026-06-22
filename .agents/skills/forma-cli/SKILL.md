---
name: forma-cli
description: Use for project-local Forma knowledge operations and agent-facing read workflows through the local `forma` binary.
---

# Forma CLI Agent Entrypoint

## Scope

This skill is the project-local Forma entrypoint for Agent-facing knowledge operations. It must not assume this repository's knowledge layout beyond what `forma config inspect` reports.

Use it for:

- Forma bootstrap checks;
- shared knowledge health review;
- task inventory and task-card inspection;
- board review for delivery state;
- read-only review prep and evidence collection;
- guideline-driven repository work.

## Bootstrap (required before Forma knowledge actions)

Run both:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`

Add `--workspace <path>` when operating on a non-default workspace.

After reading config with `config inspect`, read the guideline files listed in the effective workspace config before task, board, review, proposal, or shared knowledge operations. Treat the config result as the source of truth for which guidelines exist.

When a request involves a specific space, task, or file, inspect the target first and read any `guidelines` returned by the operation, in addition to workspace guidelines from config. Do not hard-code guideline paths, space ids, or repository directory conventions in this Skill; infer them from Forma operation results and the configured guideline contents.

## Read Commands

- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- knowledge health --json`
- `cargo run -q -p forma-cli -- tasks list --json`
- `cargo run -q -p forma-cli -- tasks inspect --json <task-id-or-path>`
- `cargo run -q -p forma-cli -- list --space <space-id> --json`
- `cargo run -q -p forma-cli -- inspect <path> --json`
- `cargo run -q -p forma-cli -- inspect --space <space-id> <entry-id> --json`

Use `--json` in machine-facing checks and for any operation that will feed review notes.

## Write Boundary

- Do not modify shared knowledge, task metadata, board state, Forma config, configured workspace structure files, configured guideline files, or repository operating state unless the user gives explicit approval.
- For multi-file knowledge edits, provide a short dry-run summary before editing unless the user already approved exact target files and change scope.
- This skill prefers read-only operation; write requests should follow configured guidelines and be verified with `cargo run -q -p forma-cli -- check --json` and `cargo run -q -p forma-cli -- knowledge health --json`.

## Local-Only Boundary

Do not commit local-only state. Determine local-only paths from configured guidelines, repository instructions, and Forma config instead of hard-coding repository layout in this Skill.

## Direct Markdown Edits

When the user asks for repository knowledge updates:

1. Edit shared Markdown in an explicit file.
2. Verify with `cargo run -q -p forma-cli -- check --json`.
3. Verify health with `cargo run -q -p forma-cli -- knowledge health --json`.
4. If the user asked for review prep, add concise review evidence from the commands above and report the resulting status.

## Guideline-Driven Workflows

- Use configured guidelines to decide which procedure applies to the user's request. Guidelines may describe task selection, delivery review, knowledge capture, schema audit, status reporting, local-only boundaries, or other repository-specific work.
- Treat guidelines as soft operating guidance. They are not machine-enforced policies, and they do not replace explicit user approval for writes or board changes.
- If the configured guidelines do not cover the request, use the available Forma read operations to report the gap and ask for approval before adding or changing guidance.
