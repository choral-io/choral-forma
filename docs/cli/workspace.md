---
id: cli.workspace
title: forma workspace
summary: Inspect workspace structure, health, and the resolved interpretation of a path.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma workspace dashboard
    - forma workspace explorer
    - forma workspace explain
    - forma workspace health
order: 45
---

# forma workspace

## Overview

Workspace commands expose read-only projections of configured content, relationships, health, and path interpretation.

Use `workspace explain` when an Agent needs to know why a path is treated as content, a view, a control file, or unmanaged:

```sh
forma workspace explain notes/example.md --json
forma workspace explain --space notes example --json
```

The result distinguishes:

- whether the path currently exists;
- its managed document kind;
- every matching content-group include pattern;
- the content group actually selected by the current index, when one exists;
- qualified taxonomy and term memberships;
- effective schema, create, template, and guideline settings;
- the config sources that establish those relationships.

A missing path can still be explained from configured patterns. Multiple content groups may match while none is selected. View-related output describes configured classification and candidates; it does not claim that an arbitrary document is included by a view evaluator.

Path names, ignored directories, and conventions such as `.forma/local/**` do not create privacy or publication guarantees.

## Agent Skill

Use `workspace explain` instead of inferring meaning from directory names. Prefer the `--space <id> <entry>` locator for an indexed entry. Use the direct path form for missing, control, view, or unmanaged paths.

Treat provenance and diagnostics as evidence. Do not reinterpret a configured content group, taxonomy, or repository convention as a built-in Forma domain concept.
