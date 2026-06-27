---
id: cli.check
title: forma check
summary: Validate the current Forma workspace.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma check
order: 40
---

# forma check

## Overview

`forma check --json` validates configuration, indexed pages, schemas, and diagnostics without writing hidden state.

## CLI Help

Use `forma check --json` to validate the current workspace after changing config, templates, schemas, guidelines, or Markdown content.

## Agent Guidance

Run this after changing `.forma.yml`, config nodes, templates, or shared Markdown content.
