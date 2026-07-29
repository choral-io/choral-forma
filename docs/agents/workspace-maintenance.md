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

Before editing shared workspace content, run `forma config summary --json` and inspect the relevant entries. Use `forma workspace explain <path> --json` when placement, content-group selection, taxonomy membership, or provenance is unclear. Use configured schemas and guidelines. Report planned multi-file edits before making them.

Before an approved `forma create`, run the same command with `--preview`. Confirm `target.writable`, the resolved path, rendered metadata, and diagnostics before writing. `target.writable` records the current preview's boundary and conflict checks; rerun the preview if config, permissions, or the target may have changed.

Run `forma check --json` after config or content changes, and run `forma workspace health --json` when relationships or references matter.
