---
id: workspace.spaces
title: Spaces
summary: Define content groups as ordinary configured spaces.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 110
---

# Spaces

## Overview

A space is a configured content group: a set of Markdown entries plus include patterns, schema, create behavior, display conventions, optional guidelines, and optional views.

A content group is a term in a taxonomy with `projection: contentGroups`. Its domain meaning, content fields, and create behavior are configured, not built-in note, collection, or project types.

## Reference

Define the taxonomy before adding terms. The taxonomy config node gives Human readers, Agents, and diagnostics a concrete declaration for the classification system that terms belong to.

```yaml
---
schemaVersion: 1
kind: taxonomy
id: spaces
projection: contentGroups
title: Spaces
mode: primary
description: Primary content groups for this workspace.
---
# Spaces
```

Use `kind: term` with the selected taxonomy id to declare a content group in an included Markdown config node. `taxonomy: spaces` below references this example's taxonomy; the id itself is not reserved.

A term uses its explicit `id`, or the config filename without its extension when `id` is omitted. For example, `.forma/spaces/notes.md` defaults to `notes`; an explicit id remains stable when the file is renamed.

```yaml
---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
description: Shared reference notes.
include:
    - "notes/**/*.md"
display:
    order: 10
conventions:
    titleField: title
    summaryField: summary
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
        summary:
            default: ""
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
        tags:
            type: list
            items:
                type: string
---
# Notes

Shared reference notes.
```

The example's `title`, `summary`, and `tags` are configured fields, not required Forma metadata. `create.template` points to the template used by `forma create`; it belongs under `create`, not at the top level of the config node.

## Agent Skill

Create a content group only after the human describes a durable content category. Define include patterns, schema, create behavior, and guidelines explicitly.

Before adding the first term for a taxonomy, add the taxonomy config node with a stable `id`. If `forma check --json` reports `config.taxonomyMissing`, add the missing taxonomy config instead of creating more term files.

After adding or changing a content group, run:

```sh
forma config summary --sources --json
forma check --json
```

Confirm that the resolved config reports the expected entry in `contentGroups` before creating content. Use `config inspect` only to debug the authored effective configuration.
