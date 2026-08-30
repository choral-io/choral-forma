---
name: forma-cli
description: Inspect, configure, and maintain Forma workspaces with the CLI.
---

# Forma CLI

Run from the workspace root or pass `--workspace <path>`. If unavailable, [install Forma](https://github.com/choral-io/choral-forma#install-scripts) and verify `forma --version`.

Bootstrap:

- `forma skills get forma-cli-core`
- `forma config summary --json`
- `forma workspace health --json`

Follow the core guide; load only task-relevant workspace skills and docs. For schema authoring, read `forma docs get workspace.schemas`.

Use `forma workspace explain <path> --json` for path classification; reserve `config inspect` for configuration debugging.

For built-in, read-only governance operations, discover the registry with `forma tools list --json` and read a contract with `forma tools describe <id> --json`; use `forma docs get cli.tools` for invocation details. Use `schema.validate` only for explicit structured artifacts; keep Markdown frontmatter and space constraints on the native Forma Schema DSL. Tools do not scan, write, auto-fix, or fetch network schema references.

Stay within the user's approved write scope. Before an approved `forma create`, run the same inputs with `--preview`. Do not modify shared content, task metadata, Forma config, guidelines, or repository operating state without explicit human approval. After approved writes, run `forma check --json` and `forma workspace health --json`.
