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

`forma skills list --json` discovers built-in and workspace-projected skills. `forma skills get <id>` prints Agent-readable Markdown guidance.

## CLI Help

Use `forma skills list --json` to discover available Agent guidance. Use `forma skills get <id>` to print one skill as Markdown for Agent reading.

## Agent Guidance

Load `forma-cli-core` first, then load any workspace-projected skills that apply to the task.
