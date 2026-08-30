---
id: cli.tools
title: forma tools
summary: Discover and run built-in, read-only workspace governance tools.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma tools list
    - forma tools describe
    - forma tools schema validate
order: 58
---

# forma tools

## Overview

`forma tools` exposes a compiled-in registry of bounded, read-only governance tools. The registry is shared by the CLI and RPC surfaces so workspace automation can discover the same contracts that a person can run locally.

The first tool is `schema.validate`. It validates one explicit JSON, single-document YAML, or JSONL file against one JSON Schema. It does not scan a workspace, write files, infer a hidden index, fetch network references, or apply fixes.

## CLI Help

Use `forma tools list --json` to discover available tools and `forma tools describe schema.validate --json` to read the tool contract.

Validate an explicit file with:

```sh
forma tools schema validate data/records.json --schema schemas/records.schema.json
forma tools schema validate data/records.jsonl --schema schemas/record.schema.json --format jsonl --json
```

`--format auto` (the default) uses `.json`, `.yaml`/`.yml`, `.jsonl`, or `.ndjson` suffixes. Pass `--format` when a file uses a non-standard suffix. All paths must be workspace-relative and remain inside the workspace boundary.

The JSON result uses the normal Forma operation envelope. Schema violations include the data path, JSON Pointer `instancePath`, JSON Pointer `schemaPath`, and failed Schema keyword. JSONL diagnostics additionally include the 1-based record line.

## Agent Skill

Use `tools.list` before depending on a built-in tool contract. Use `tools.describe` when you need its input formats or read-only guarantees. Use `tools.schema.validate` for explicit structured artifacts; keep Markdown frontmatter and space constraints on the native Forma Schema DSL.

Treat a failed validation as a gate for the calling workflow. The operation is diagnostic-first and has no auto-fix mode. Keep schemas and data under the workspace boundary; network and non-file `$ref` resolution is disabled.

## Reference

`schema.validate` uses JSON Schema Draft 2020-12. A schema may be JSON or a single YAML document. YAML data is intentionally single-document; use JSONL for multiple records. Blank JSONL lines are ignored, while each non-blank line is parsed and validated independently.
