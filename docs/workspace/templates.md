---
id: workspace.templates
title: Templates
summary: Define create templates for new Markdown entries.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 130
---

# Templates

## Overview

Templates are Markdown files referenced by a space create configuration. They use `{{ input.name }}` placeholders for values resolved by `forma create`.

## Agent Guidance

Keep templates small, readable, and aligned with the configured schema. Verify template paths with `forma check --json`.
