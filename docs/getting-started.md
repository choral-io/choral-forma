---
id: getting-started
title: Getting Started
summary: Start using Forma in a content workspace.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
order: 10
---

# Getting Started

## Overview

[Install Forma](https://github.com/choral-io/choral-forma#install-scripts) and verify `forma --version`. Run workspace commands from your content directory, or pass `--workspace <path>`.

## CLI Help

For a new workspace:

```sh
forma init
forma config summary --json
forma check --json
```

`init` creates the configuration entry point and an Agent bootstrap skill without overwriting existing files. For an existing workspace, skip initialization and inspect its summary.

## Create And Read Content

Follow [First-Slice Config](workspace/first-slice-config.md) to define a content group and [Templates](workspace/templates.md) for its create template. Use names and fields that match your content.

For a content group with a configured `title` input, preview an entry with `forma create <content-group-id> --input 'title=First entry' --preview --json`. Review its path and diagnostics before repeating the command without `--preview` to write it. See [create](cli/create.md) for input and preview details.

Find entries with `forma list --space <content-group-id> --json` and examine their fields with `forma inspect <path> --json`. Use a table [view](workspace/views.md) to compare fields across entries. Run `forma check --json` and `forma workspace health --json` after changes; add [guidelines](workspace/guidelines.md) when the workflow needs them.

## Agent Skill

Load `forma skills get forma-cli-core` for workflow routing and configured guideline discovery. Reuse the user's stated goals; clarify only what is needed to choose the next action, and keep writes within the approved scope.
