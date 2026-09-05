---
id: workspace.guidelines
title: Guidelines
summary: Use ordinary Markdown guidance for Human and Agent collaboration.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 150
---

# Guidelines

## Overview

Guidelines are ordinary Markdown files declared in `.forma.md` or space configuration. They provide soft collaboration rules, Human-readable background, and Agent workflows.

Each `guidelines` item may be an exact workspace-relative file path or a glob:

```yaml
guidelines:
    - guidance/core.md
    - guidance/engineering/*.md
    - guidance/review/**/*.md
```

Root declarations apply workspace-wide; a content group's declarations apply to that group. Core expands patterns to regular `.md` and `.mdx` files using the same path rules as imports and content selection: `*` and `?` stay within one directory component, while `**` can cross directories. Patterns do not follow symlinks. Git ignore rules and names such as `local` do not exclude explicitly matched files.

Declaration order is preserved, each glob's matches are sorted by workspace-relative path, and repeated paths keep their first occurrence. A glob with no Markdown matches produces `config.guidelineGlobNoMatches` as a warning; an invalid glob is an error. An exact missing file remains a `config.guidelineMissing` error. Distinct matched files declaring the same skill ID remain an error.

`config summary`, applicable-guideline results, and skill discovery use the same resolved files. `config summary --sources --json` additionally reports `guidelineSources`: the declaring `sourcePath`, optional `contentGroup`, indexed `field`, authored `pattern`, and concrete `paths` (empty for a pattern with no matches). `config inspect` preserves authored declarations. Persistent workspace watchers include guideline patterns so newly added and removed matching files refresh the configuration snapshot.

Declaring a pattern selects guidance; it does not require Agents to load every matched file or grant write/publication permission.

## Agent Skill

Declare guideline files in `.forma.md` or a configured space. All configured guidelines guide the work; only those with `skill` metadata appear in `forma skills list --json`. Load a discovered skill with `forma skills get <id>`; use `--full` only when the default section lacks the needed authoring or reference context.

For guideline globs, inspect resolved paths and declaration provenance with `config summary --sources --json`. Read the Overview for matching and diagnostic rules; load only guidance applicable to the current operation.

For `skill.projection: section`, include exactly one complete `## Agent Skill` section with its use boundary, approval or stop condition, necessary steps, and verification. Put Human background and conditional detail elsewhere in the Markdown. Use `projection: full` only when projecting the full guideline is intentional.

Describe the distinct action the skill supports once in `skill.description`; do not repeat trigger lists. Forma generates `metadata.forma-source-ref` for projected guidelines, so do not author it. A source reference is provenance, not authority to write or publish.

See `forma docs get cli.skills` for public id, projection, and source-reference rules.
