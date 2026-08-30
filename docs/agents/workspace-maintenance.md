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
    description: Maintain an existing Forma workspace with configuration-aware previews, approved edits, and verification.
    order: 30
order: 220
---

# Workspace Maintenance

## Agent Skill

Start read-only: run `forma config summary --json`, inspect the relevant entries, and read applicable configured guidelines. Use `forma workspace explain <path> --json` when placement, content-group selection, or provenance is unclear.

Do not change shared content or configuration without approval. Keep the edit within the approved scope; state a multi-file plan when its boundaries are not already clear. Before an approved `forma create`, run the same command with `--preview`, confirm the resolved path, metadata, and diagnostics, and rerun it if the target or configuration changed.

Run `forma check --json` after config or content changes, and run `forma workspace health --json` when relationships or references matter.

### Completion Criteria

Finish only after the approved files are changed, configuration-derived placement remains valid, required checks pass, and unresolved diagnostics or unverified behavior are reported.
