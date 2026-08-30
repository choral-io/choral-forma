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

Stay within the user's approved write scope. Preview creates with `--preview`; after writes, run `forma check --json` and `forma workspace health --json`.
