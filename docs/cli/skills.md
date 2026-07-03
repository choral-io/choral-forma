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

`forma skills list --json` discovers built-in and workspace-projected skills. `forma skills get <id>` prints compact Agent-readable Markdown guidance. For guideline-backed skills, the default output uses the guideline's `## Agent Skill` section when present; use `--full` to print the complete guideline.

## CLI Help

Use `forma skills list --json` to discover available Agent guidance. Use `forma skills get <id>` to print one compact skill as Markdown for Agent reading. Use `forma skills get <id> --full` only when full Human-facing background or reference material is needed.

## Agent Guidance

Load `forma-cli-core` first, then load only workspace-projected skills that apply to the task. Prefer the default compact projection. Use `--full` for audit, ambiguity, or guideline authoring work that needs the complete source.
