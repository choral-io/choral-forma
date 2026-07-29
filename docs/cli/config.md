---
id: cli.config
title: forma config
summary: Inspect raw effective configuration or summarize resolved workspace structure.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma config inspect
    - forma config summary
order: 30
---

# forma config

## Overview

`forma config inspect --json` reads `.forma.md`, applies explicitly imported configuration files, and reports the effective workspace configuration without changing its existing output shape.

`forma config summary --json` provides the smaller, resolved model an Agent normally needs to plan content organization: content groups, flattened schema fields, create contracts, taxonomies, semantic types, views, guidelines, and runtime provider kinds.

## CLI Help

Use `forma config summary --json` for planning. Add `--group ID` to select one content group by its exact ID. The filter changes the returned content-group list and its overview count; taxonomies, semantic types, views, guidelines, and runtime provider metadata remain workspace-level context.

Configuration provenance fields and the imported source list are omitted by default. Add `--sources` when provenance is needed:

```sh
forma config summary --group notes --sources --json
```

The summary reports whether a create input has a default, but not the default value. It reports runtime provider kinds and transforms, but not resolved values, provider keys, or constant values. Template paths are included; template bodies are not.

Use `forma config inspect --json` when debugging the authored effective configuration or when the complete configuration payload is specifically required.

## Agent Skill

Start with `config summary` before choosing paths, metadata, schemas, templates, or views. Escalate to `config inspect` only when the summary does not contain enough detail.
