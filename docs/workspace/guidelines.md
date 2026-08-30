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

Declare guideline files in `.forma.md` or a configured space. All configured guidelines guide the work; only those with `skill` metadata appear in `forma skills list --json`. Load a discovered skill with `forma skills get <id>`; use `--full` only when the default section lacks the needed authoring or reference context.

For `skill.projection: section`, include exactly one complete `## Agent Skill` section with its use boundary, approval or stop condition, necessary steps, and verification. Put Human background and conditional detail elsewhere in the Markdown. Use `projection: full` only when projecting the full guideline is intentional.

Describe the distinct action the skill supports once in `skill.description`; do not repeat trigger lists. Forma generates `metadata.forma-source-ref` for projected guidelines, so do not author it. A source reference is provenance, not authority to write or publish.

See `forma docs get cli.skills` for public id, projection, and source-reference rules.
