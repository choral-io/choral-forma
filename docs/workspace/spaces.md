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

Forma core does not have built-in task, note, member, or guideline domain concepts. Those are ordinary content groups defined by configuration. The product may call this pattern a "space" because it is useful for navigation and UI, but the durable source of truth is the config node that projects into the effective `spaces` map.

## Reference

Define the taxonomy before adding terms. The taxonomy config node gives Human readers, Agents, and diagnostics a concrete declaration for the classification system that terms belong to.

```yaml
---
schemaVersion: 1
kind: taxonomy
id: spaces
title: Spaces
mode: primary
description: Primary content groups for this workspace.
---
# Spaces
```

Use `kind: term` with `taxonomy: spaces` to declare a content group in an included Markdown config node. The `taxonomy` value must match the taxonomy config node `id`.

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
        type:
            type: string
        tags:
            type: list
            items:
                type: string
---
# Notes

Shared reference notes.
```

The `create.template` value points to the template used by `forma create`. It is nested under `create`, not a top-level field in the authored config node.

## Agent Guidance

Create a content group only after the human describes a durable content category. Define include patterns, schema, create behavior, and guidelines explicitly.

Before adding the first term for a taxonomy, add the taxonomy config node with a stable `id`. If `forma check --json` reports `config.taxonomyMissing`, add the missing taxonomy config instead of creating more term files.

After adding or changing a content group, run:

```sh
forma config inspect --json
forma check --json
```

Confirm that the effective config reports the expected entry under `spaces` before creating content.
