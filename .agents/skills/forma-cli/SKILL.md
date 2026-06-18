---
name: forma-cli
description: Use when managing repository-backed Forma knowledge through the local forma CLI, including workspace checks, task inventory, task board reads, knowledge health, page inspection, and JSON outputs for Agent reasoning.
---

# Forma CLI

## Purpose

Use this skill when work should be grounded in Forma product operations through the local CLI instead of hand-parsing the knowledge base.

## Preconditions

- Run commands from the repository root by default; if another workspace is explicitly named, run in that workspace context.
- Prefer `--json` outputs for Agent reasoning and downstream interpretation.
- Do not rely on hidden persistent indexes; work against repository files and CLI JSON.
- Do not treat Knowledge Workflow process files as product requirements.

## Read Commands

- `cargo run -p forma-cli -- check --json`
- `cargo run -p forma-cli -- tasks list --json`
- `cargo run -p forma-cli -- tasks inspect knowledge/tasks/example.md --json`
- `cargo run -p forma-cli -- board show --json`
- `cargo run -p forma-cli -- knowledge health --json`
- `cargo run -p forma-cli -- inspect knowledge/product/product-direction.md --json`

## Write Boundary

This release uses the CLI for read, audit, and selection workflows. All knowledge edits still happen through explicit Markdown file changes, followed by CLI verification of resulting state.

## Response Rules

- Summarize relevant fields from CLI JSON output and call out key findings directly.
- Always include any diagnostics (codes and file paths) when present.
- Never report healthy/clean state when output status is `warning` or `failed`.
- If a CLI command is unavailable, fall back to direct Markdown reads and clearly state what is missing from the CLI path.
