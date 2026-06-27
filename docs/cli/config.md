---
id: cli.config
title: forma config
summary: Inspect the effective Forma workspace configuration.
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

`forma config inspect --json` reads `.forma.yml`, applies explicitly included configuration files, and reports the effective workspace configuration.

## Agent Guidance

Use config output before choosing paths or editing workspace structure.
