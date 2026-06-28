---
id: cli.config
title: forma config
summary: Inspect the effective workspace configuration.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma config inspect
order: 30
---

# forma config

## Overview

`forma config inspect --json` reads `.forma.md`, applies explicitly imported configuration files, and reports the effective workspace configuration.

## CLI Help

Use `forma config inspect --json` to see the effective workspace name, sources, spaces, views, guidelines, runtime values, and diagnostics.

## Agent Guidance

Use config output before choosing paths or editing workspace structure.
