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

Templates are Markdown files referenced by a configured content group's `create.template` setting. `forma create` resolves `{{ input.<name> }}` placeholders from the group's declared `create.inputs`; input names are not built in.

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
---

# {{ input.title }}
```

Create input defaults and templates can also read configured runtime values. For the `buildTime` value declared in [Runtime Values](configuration.md#runtime-values), an input default can use:

```yaml
create:
    inputs:
        createdAt:
            default: "{{ runtime.values.buildTime }}"
```

Define each referenced runtime name before using it; provider kinds do not automatically create variables with the same names.

For a schema field using a named type, inspect its declaration before choosing a default. [Schemas](schemas.md#named-types) explains the declaration; [Entry References](configuration.md#entry-references) defines the stored path for a reference or list of references.

## Agent Skill

Keep templates small, readable, and aligned with the configured schema. Verify template paths with `forma check --json`. For entry-reference defaults, inspect the named type and read `forma docs get workspace.configuration` before writing the template.
