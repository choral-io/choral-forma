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

`forma skills list --json` discovers built-in skills declared in canonical docs and workspace-projected skills. `forma skills get <id>` prints compact Agent-readable Markdown guidance. For skill-backed documents, the default output uses the document's `## Agent Skill` section; use `--full` to print the complete source.

## CLI Help

Use `forma skills list --json` to discover available Agent guidance. Use `forma skills get <id>` to print one compact skill as Markdown for Agent reading. Use `forma skills get <id> --full` only when full Human-facing background or reference material is needed.

## Agent Skill

Load `forma-cli-core` first, then load only skills that apply to the task. Prefer the default compact projection. Use `--full` for audit, ambiguity, or guideline authoring work that needs the complete source.

## Migration

Built-in skills must use `## Agent Skill`; the build validates that section. Workspace guidelines using the legacy `## Agent Guidance` heading remain readable as a compatibility fallback, but should be renamed to `## Agent Skill` when they are next edited. A document without either heading still returns its full body for backward compatibility.
