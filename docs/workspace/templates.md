---
id: workspace.templates
title: Templates
summary: Define create templates for new Markdown entries.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 130
---

# Templates

## Overview

Templates are Markdown files referenced by a configured content group's `create.template` setting. They use `{{ input.title }}`, `{{ input.summary }}`, or other configured input placeholders resolved by `forma create`.

## Reference

Reference a template from `create.template` in the content group config:

```yaml
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
```

A minimal template can define frontmatter and body content:

```markdown
---
title: "{{ input.title }}"
summary: "{{ input.summary }}"
type: note
tags: []
---

# {{ input.title }}

{{ input.summary }}
```

Create input defaults and templates can also read configured runtime values:

```yaml
create:
    inputs:
        owner:
            default: "{{ runtime.values.currentUserRef }}"
        createdAt:
            default: "{{ runtime.values.currentDateTime }}"
```

Define those names under `runtime.values` in `.forma.md` or an explicitly included config file before using them in defaults or templates.

When a schema field is a `ref` or list of `ref` values, store the workspace reference path expected by that schema, not only the raw runtime id. Do not assume a built-in directory such as `members/`. If a workflow needs a current-user reference, define a workspace-specific runtime value such as `currentUserRef` whose value already matches that workspace's configured reference path.

## Agent Guidance

Keep templates small, readable, and aligned with the configured schema. Verify template paths with `forma check --json`.
