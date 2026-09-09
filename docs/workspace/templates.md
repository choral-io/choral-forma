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

## Structured Markdown Templates

Set `create.templateMode: structuredMarkdown` to substitute frontmatter values before YAML serialization. The default, `text`, retains literal string substitution for existing templates.

In structured mode the template must have YAML mapping frontmatter. Quote placeholders in the authored YAML, such as `title: "{{ input.title }}"`. A placeholder occupying an entire value preserves the input's type. Quotes, newlines, and placeholder-looking text inside an input remain data and are not evaluated again. Mapping keys must be literal strings; YAML tags are unsupported.

A mapping value consisting entirely of a declared optional input placeholder is omitted when that input is absent. Explicit `null` remains `null`; schema validation may reject it. Missing inputs inside a text fragment, sequence item, or Markdown body are errors. Body placeholders continue to use text substitution. Neither mode invents defaults for absent values.

Use `create --preview --json` to inspect the resulting metadata and schema diagnostics before creating content.

Frontmatter closes only when `---` starts at the beginning of a line (trailing whitespace is allowed). An indented `---` inside a YAML block scalar remains part of that value. Documents that previously used an indented closing marker must move the actual closing marker to column 1. This parser correction also applies to existing text-mode templates and other Markdown readers.
