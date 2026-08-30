---
id: agents.workspace-example-accelerator
title: Workspace Example Accelerator
summary: Optional example-first accelerator for Agents when a Human explicitly asks for a starter or example-shaped fast path.
audience:
    - agent
surfaces:
    - docs
order: 215
---

# Workspace Example Accelerator

## Agent Skill

Use this only when the Human explicitly asks for an example, starter, or known pattern. It accelerates an accepted slice; it is never the default bootstrap path.

If the slice is not yet clear, use `agents.workspace-design-discovery`. Otherwise reuse the accepted requirements; do not repeat discovery or approval.

Inspect only the relevant example material. State what will be copied, adapted, or skipped, and obtain approval before writing any shared config or content that is not already in scope.

Keep example identifiers, layout, and content as reference material rather than Forma built-ins. Do not bring in extra spaces, views, guidelines, or full example content outside the approved scope; path names do not establish privacy or publication boundaries.

Verify the result with the same commands as the no-example path: `forma config summary --sources --json`, `forma check --json`, `forma workspace health --json` when relationships matter, and relevant preview or entry operations.

If the example makes the scope unclear or encourages bulk copying, return to `agents.workspace-bootstrap`.
