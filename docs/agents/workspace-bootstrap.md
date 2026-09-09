---
id: agents.workspace-bootstrap
title: Workspace Bootstrap
summary: Guide Agents through turning an initialized empty workspace into a useful content workspace.
audience:
    - agent
surfaces:
    - docs
    - skill
skill:
    id: forma-workspace-bootstrap
    title: Forma Workspace Bootstrap
    description: Bootstrap one approved content workflow into a verified first Forma workspace slice after initialization.
    order: 20
order: 210
---

# Workspace Bootstrap

## Agent Skill

After `forma init`, turn an accepted real content workflow into the smallest useful configured slice. The default is no-example bootstrap; do not copy a starter or example unless the human asks for one.

Reuse an accepted design brief. If scope is uncertain, load `forma-workspace-design` and ask only the questions that affect this slice. Do not assume that tasks, notes, members, or guidelines are required.

For an initialized workspace with an empty configured corpus, one new content group, text/date fields, and a table, load `forma skills get forma-guided-modeling` and use its prepare/review/apply workflow. Return here only if the requirements exceed that compiler's scope.

For other approved configuration requirements, load `workspace.first-slice-config` and only the needed spaces, schemas, or templates references with `forma docs get`, then follow the explicit configuration steps below. Existing-content inventory or import requires its own agreed scope; do not remove existing content to qualify for modeling. For an explicit example request, load `agents.workspace-example-accelerator` instead of treating examples as a default dependency.

Before a write whose boundaries are not already approved, state the proposed configured space, fields, files, deferred relationships, and verification commands, then wait for approval. Otherwise implement the approved scope without asking for duplicate confirmation.

### Explicit Configuration

1. Add only the approved configured group, schema, template, view, or guideline needed by the slice.
2. Run `forma config summary --group <content-group-id> --sources --json` and `forma check --json`.
3. Before an approved create, run the same `forma create` command with `--preview --json` and confirm its target, metadata, and diagnostics.
4. Create only approved content, then verify it with the relevant `list`, `inspect`, or `workspace explain` command.
5. Run `forma workspace health --json` when relationships matter, and report isolated-page warnings as relationship feedback unless a connected graph was expected.

### Guardrails

- Use the Human's domain language for configured ids and titles.
- Treat example names and layouts as configured choices, not Forma built-ins.
- Keep material requiring privacy outside configured workspace inputs until repository, hosting, and access controls define its handling.

### Completion Criteria

The slice is complete when its approved configuration resolves, required checks pass, created content (if any) is verified, and remaining diagnostics are reported.
