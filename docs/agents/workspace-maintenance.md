---
id: agents.workspace-maintenance
title: Workspace Maintenance
summary: Maintain workspace content through explicit Forma config and verification.
audience:
    - agent
surfaces:
    - docs
    - skill
skill:
    id: forma-workspace-maintenance
    title: Forma Workspace Maintenance
    description: Use to make verified, configuration-aware maintenance changes to an existing workspace.
    triggers:
        - maintain workspace
        - edit workspace content
        - review workspace changes
    order: 30
order: 220
---

# Workspace Maintenance

## Agent Skill

Before editing shared workspace content, inspect the effective config and relevant entries. Use configured schemas and guidelines. Report planned multi-file edits before making them.

Run `forma check --json` after config or content changes, and run `forma workspace health --json` when relationships or references matter.
