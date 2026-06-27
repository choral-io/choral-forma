---
id: agents.workspace-maintenance
title: Workspace Maintenance
summary: Maintain workspace content through explicit Forma config and verification.
audience:
    - agent
surfaces:
    - docs
    - skill
order: 220
---

# Workspace Maintenance

## Agent Guidance

Before editing shared workspace content, inspect the effective config and relevant entries. Use configured schemas and guidelines. Report planned multi-file edits before making them.

Run `forma check --json` after config or content changes, and run `forma workspace health --json` when relationships or references matter.
