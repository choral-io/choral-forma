---
id: cli.skills
title: forma skills
summary: Discover Agent-facing guidance from built-in docs and workspace guidelines.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma skills list
    - forma skills get
order: 60
---

# forma skills

## Overview

`forma skills list --json` discovers built-in skills declared in canonical docs and workspace-projected skills. `forma skills get <id>` prints Agent-readable, `SKILL.md`-compatible Markdown with `name`, `description`, and a Forma source reference.

The list result reports each skill's `projection`. Built-in skills always project one compact `## Agent Skill` section. Workspace guideline metadata chooses `projection: section` for the same behavior or `projection: full` when the complete guideline is intentionally the skill.

## CLI Help

Use `forma skills list --json` to discover available Agent guidance. Use `forma skills get <id>` to print its default projection. Use `forma skills get <id> --full` to override section projection when complete Human-facing background or reference material is needed.

## Agent Skill

Load `forma-cli-core` first, then load only skills that apply to the task. Prefer the default projection. Use `--full` for audit, ambiguity, branch-specific reference, or guideline authoring work that needs the complete source.

## Projection Contract

Built-in skills require a valid id, non-empty title and description, and exactly one real top-level `## Agent Skill`; the build validates this contract. Workspace guideline skills use the same metadata rules at runtime.

Skill ids become Agent Skills `name` values. They must contain 1-64 lowercase ASCII letters, numbers, or hyphens, without leading, trailing, or repeated hyphens. Descriptions must contain 1-1024 characters. Triggers are optional; when declared, each trigger must be non-empty and unique.

Workspace guideline metadata declares one projection:

```yaml
skill:
    id: example-skill
    title: Example Skill
    description: Route example work through the required checks and completion criteria.
    projection: section
```

- `section` is the default and requires exactly one `## Agent Skill`.
- `full` intentionally projects the complete guideline and does not require that heading.
- Legacy `## Agent Guidance` remains readable with a migration warning.
- Missing or ambiguous section projection is an error instead of a silent full-body fallback.

Descriptions are the invocation source of truth. Front-load one distinctive action word and name each genuinely different triggering branch once. Keep the projected body focused on execution order, required boundaries, reference routing, and checkable completion criteria.

## Source References

Generated `skills get` Markdown records its canonical source in Agent Skills metadata:

```yaml
metadata:
    forma-source-ref: "docs:agents.forma-cli-core"
```

- `docs:<document-id>` identifies a canonical embedded document retrievable with `forma docs get <document-id>`.
- `workspace:<relative-path>` identifies a configured guideline relative to the Forma workspace root.

Source references are provenance, not authorization, privacy, or publication guarantees. Forma never emits an absolute host path. `forma init` creates a local runtime bootstrap Skill rather than a projection of one canonical source, so it does not claim `forma-source-ref`.

When changing Skill metadata, projection, section extraction, or generated frontmatter, update built-in validation, workspace validation, CLI output tests, and this document in the same change.
