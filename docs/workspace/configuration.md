---
id: workspace.configuration
title: Workspace Configuration
summary: Define the minimal `.forma.md` and included config node model.
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

`.forma.md` is the single configuration entry point. All persisted file references are workspace-relative POSIX paths resolved from the directory containing `.forma.md`.

Forma configuration is built from explicit files. The root `.forma.md` declares workspace settings and `include` patterns in YAML frontmatter. Its Markdown body can explain the workspace for humans and Agents. Included Markdown or YAML config nodes then define higher-level workspace behavior such as content groups, templates, views, guidelines, schemas, and runtime values.

Forma does not infer workspace semantics from directory names. A directory named `notes`, `tasks`, or `members` has no special meaning until a config node describes how files in that directory should be indexed, created, displayed, or checked.

## CLI Help

Use `forma config inspect --json` to inspect the effective workspace configuration and source paths. Use `forma check --json` after editing `.forma.md` or included config nodes.

## Reference

The minimal `.forma.md` contains `schemaVersion`, `workspace`, `include`, and `runtime.values` in frontmatter.

```md
---
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
---

# Untitled Forma Workspace

This file is the Forma workspace entry point.
```

Runtime values define named values that templates and create defaults can read with `{{ runtime.values.<name> }}`. They are explicit config, not hidden identity or environment assumptions. Supported provider kinds are:

| kind | Fields | Use |
| --- | --- | --- |
| `const` | `value`, optional `required`, `transform` | Explicit configured value, often in an included local config file. |
| `gitConfig` | `key`, optional `required`, `transform` | Read a value from Git config, such as `user.name` or `user.email`. |
| `currentDate` | none | Current date in `YYYY-MM-DD`, resolved with `workspace.timezone`. |
| `currentDateTime` | none | Current datetime in RFC3339, resolved with `workspace.timezone`. |
| `workspaceRoot` | none | Workspace root path as seen by Forma. |

`transform` currently applies only to `const` and `gitConfig` values. Use `required: true` only when the operation should report an unresolved runtime value if the provider cannot resolve a value.

```yaml
runtime:
    values:
        currentDate:
            kind: currentDate
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot
        currentUserId:
            kind: gitConfig
            key: user.name
            transform: slugify
```

Use `currentUserId` only when the workspace workflow needs a current user value, for example to default an owner or author field. It is not built in; it is a normal runtime value name. It can be resolved from Git config as above, or overridden by an explicitly included local config file:

```yaml
runtime:
    values:
        currentUserId:
            kind: const
            value: alex-chen
            required: true
            transform: slugify
```

For `ref` fields, keep runtime values as identity inputs and let the workspace template express the reference path explicitly. For example, a workspace may use `{{ runtime.values.currentUserId }}` inside `people/{{ runtime.values.currentUserId }}` if that is the configured reference form for the target content type. Do not introduce extra runtime values that only duplicate a path assembled from other runtime values.

Named types define reusable schema meanings. They may be declared in root `.forma.md` or in included config nodes. Effective config merges them into one global `types` map, and duplicate type names are reported as configuration errors.

```yaml
types:
    person:
        kind: ref
        source: .forma/spaces/people
        input:
            transform: slugify
    noteStatus:
        kind: enum
        values:
            - draft
            - active
            - archived
```

`source` is a workspace-relative config path resolved from the directory containing `.forma.md`, not a taxonomy-qualified logical id. The `.md` extension may be omitted for Markdown config nodes.

Included Markdown config nodes use frontmatter as their machine-readable configuration and Markdown body as Human-readable documentation. A taxonomy should be declared before its terms:

```yaml
---
schemaVersion: 1
kind: taxonomy
id: spaces
title: Spaces
mode: primary
---
```

In the current P0 configuration model, a configured content group is commonly declared as a taxonomy term:

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

`taxonomy: spaces` must match a declared taxonomy `id`. It also projects this config node into the effective `spaces` map reported by `forma config inspect --json`. `space`, `note`, `task`, and similar names are not built-in domain objects; they are configured patterns derived from explicit config.

## Agent Guidance

Do not infer configuration from `.gitignore` or path names. Add config nodes through explicit include patterns. Before adding term nodes, make sure the referenced taxonomy has a `kind: taxonomy` config node with a matching `id`. Then verify the effective model with `forma config inspect --json` and `forma check --json`.
