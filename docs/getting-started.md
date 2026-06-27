---
id: getting-started
title: Getting Started
summary: Start using Forma in a project directory.
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

Install the `forma` binary, run commands from the target workspace root, and keep repository Markdown as the source of truth.

Forma is not limited to a single domain such as tasks, notes, or project documentation. Start with one real workflow you want to organize, then let its language define the first content group, fields, template, and views.

## CLI Help

Use `forma init` to create the minimal workspace bootstrap in an empty project. Then run `forma check --json` and `forma skills get forma-cli-core`.

## Agent Guidance

After initialization, load the Forma CLI Core skill and ask the human what workflow they want to organize first. Translate that workflow into the smallest useful content group before creating additional spaces, templates, views, or guidelines.
