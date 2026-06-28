---
name: forma-cli
description: Use for Forma workspace operations, workspace inspection, configuration checks, and agent-facing Forma workflows.
---

# Forma CLI

Run from the target workspace root, or pass `--workspace <path>`.

If `forma` is missing, install it from https://github.com/choral-io/choral-forma#install-scripts. Installation requires internet access. Verify with `forma --version`.

Bootstrap:

- `forma skills get forma-cli-core`
- `forma config inspect --json`
- `forma workspace health --json`

Use `forma-cli-core` and workspace-projected skills for command details and workflow guidance. Do not assume repository layout, guideline paths, space ids, or local-only paths beyond Forma output and repository instructions.

Do not modify shared content, task metadata, Forma config, guidelines, or repository operating state without explicit human approval. After approved writes, run `forma check --json` and `forma workspace health --json`.
