---
id: workspace.configuration
title: Workspace Configuration
summary: Define the minimal `.forma.yml` and included config node model.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
    - skill
order: 100
---

# Workspace Configuration

## Overview

`.forma.yml` is the single configuration entry point. All persisted file references are workspace-relative POSIX paths resolved from the directory containing `.forma.yml`.

## CLI Help

Use `forma config inspect --json` to inspect the effective workspace configuration and source paths. Use `forma check --json` after editing `.forma.yml` or included config nodes.

## Reference

The minimal empty workspace contains `schemaVersion`, `workspace`, `include`, and `runtime.values`.

```yaml
schemaVersion: 1

workspace:
    name: "Untitled Forma Workspace"
    canonicalLanguage: "en"
    supportedLanguages:
        - "en"
    timezone: "UTC"

include:
    - ".forma/*.md"
    - ".forma/spaces/*.md"
    - ".forma/views/*.md"
    - ".forma/local/*.yml"
    - ".forma/local/*.md"

runtime:
    values:
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot
```

## Agent Guidance

Do not infer configuration from `.gitignore` or path names. Add config nodes through explicit include patterns and verify with `forma config inspect --json`.
