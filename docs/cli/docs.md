---
id: cli.docs
title: forma docs
summary: Discover and read the canonical built-in Forma documentation.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma docs list
    - forma docs get
order: 55
---

# forma docs

## Overview

`forma docs list` and `forma docs get <id>` read the canonical documentation embedded in the Forma binary. They do not require a valid workspace configuration.

## CLI Help

Use `forma docs list --json` to discover document ids and metadata. Use `forma docs get <id>` for Markdown output or add `--json` to receive the typed `docs.get` result.

## Agent Skill

Load only the document needed for the current workflow. Built-in docs are product documentation; workspace guidelines and their projected skills remain separately configured by the target workspace.
