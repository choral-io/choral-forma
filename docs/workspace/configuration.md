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

Forma configuration is built from explicit files. The root `.forma.yml` declares workspace settings and `include` patterns. Included Markdown or YAML config nodes then define higher-level workspace behavior such as content groups, templates, views, guidelines, schemas, and runtime values.

Forma does not infer workspace semantics from directory names. A directory named `notes`, `tasks`, or `members` has no special meaning until a config node describes how files in that directory should be indexed, created, displayed, or checked.

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

Included Markdown config nodes use frontmatter as their machine-readable configuration and Markdown body as Human-readable documentation. In the current P0 configuration model, a configured content group is commonly declared as a taxonomy term:

```yaml
---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
    - "notes/**/*.md"
create:
    directory: notes
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/note.md
    inputs:
        title:
            required: true
        slug:
            default: "{{ input.title }}"
            transform: slugify
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
---
```

`taxonomy: spaces` projects this config node into the effective `spaces` map reported by `forma config inspect --json`. `space`, `note`, `task`, and similar names are not built-in domain objects; they are configured patterns derived from explicit config.

## Agent Guidance

Do not infer configuration from `.gitignore` or path names. Add config nodes through explicit include patterns, then verify the effective model with `forma config inspect --json`.
