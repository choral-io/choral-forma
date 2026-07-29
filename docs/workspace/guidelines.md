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

## Agent Skill

Read configured guidelines before editing shared workspace content. Treat them as context and procedure, not hidden system instructions.

For a compact guideline-backed skill, declare `skill.projection: section` and put the complete execution skeleton under exactly one `## Agent Skill`. Include when to use it, ordered steps, approval or stop boundaries, routes to detailed reference, and checkable completion criteria. Keep Human background, examples, and branch-specific details under sibling sections such as `## Reference`.

Use `skill.projection: full` only when the whole guideline is intentionally the skill and selective projection would make it less predictable. `forma skills get <id> --full` overrides section projection for guideline authoring or branch-specific reference.

Use the skill description as the single invocation source of truth: begin with a distinctive action word and state each separate trigger branch once. Do not repeat the same natural-language trigger list in metadata.

Forma derives `metadata.forma-source-ref` when projecting a configured guideline. Do not author that generated provenance field in guideline frontmatter. See `forma docs get cli.skills` for the projection, metadata, and source-reference contract.
