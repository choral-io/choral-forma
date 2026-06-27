---
id: agents.knowledge-maintenance
title: Knowledge Maintenance
summary: Maintain Forma workspace knowledge through explicit config and verification.
audience:
    - agent
surfaces:
    - docs
    - skill
order: 220
---

# Knowledge Maintenance

## Agent Guidance

Before editing shared knowledge, inspect the effective config and relevant entries. Use configured schemas and guidelines. Report planned multi-file edits before making them.

Run `forma check --json` after config or content changes, and run `forma knowledge health --json` when relationships or references matter.
