---
id: agents.workspace-troubleshooting
title: Workspace Troubleshooting
summary: Diagnose Forma workspace failures without treating repository conventions as product behavior.
audience:
    - agent
surfaces:
    - docs
    - skill
skill:
    id: forma-workspace-troubleshooting
    title: Forma Workspace Troubleshooting
    description: Use to diagnose configuration, discovery, validation, or reference failures with read-only evidence first.
    triggers:
        - troubleshoot workspace
        - diagnose Forma error
        - config inspect failed
        - workspace health warning
    order: 40
order: 225
---

# Workspace Troubleshooting

## Agent Skill

Start with read-only evidence:

1. Run `forma config summary --sources --json`, `forma check --json`, and `forma workspace health --json` from the target workspace root.
2. Read the diagnostics and resolved provenance before suggesting edits. Escalate to `forma config inspect --json` only when the authored effective configuration must be debugged.
3. Use `forma workspace explain` for the implicated path, including a missing or unmanaged path. Use `forma inspect`, `forma list`, or `forma view render` only for the configured content group or view implicated by the diagnostic.
4. Treat directory names, ignored files, and paths such as `.forma/local/**` as repository conventions, not privacy or publication guarantees. A configured file participates according to its configuration.
5. Propose the smallest config or content correction and wait for approval before changing shared workspace material.

For missing configuration, explain that built-in docs and skills remain available, then ask whether the human wants `forma init`. For a malformed configuration, preserve the source and address the reported diagnostic before editing unrelated content.

## Reference

Use `forma docs get workspace.configuration` for configuration syntax and `forma docs get workspace.guidelines` for configured operating rules.
