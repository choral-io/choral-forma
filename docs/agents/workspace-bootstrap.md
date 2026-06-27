---
id: agents.workspace-bootstrap
title: Workspace Bootstrap
summary: Guide Agents through turning an initialized empty workspace into a useful knowledge base.
audience:
    - agent
surfaces:
    - docs
    - skill
order: 210
---

# Workspace Bootstrap

## Agent Guidance

After `forma init`, ask the human for the first durable knowledge scenario. Define one content category at a time, then add its space, template, optional view, and guideline.

Do not assume that tasks, notes, members, or guidelines are required in every workspace.

For the first content category:

1. Load `workspace.configuration`, `workspace.spaces`, and `workspace.templates` with `forma docs get`.
2. Add one included config node, commonly `kind: term` with `taxonomy: spaces`.
3. Add one template referenced by `create.template`.
4. Run `forma config inspect --json` and confirm the expected entry appears under `spaces`.
5. Run `forma check --json`.
6. Create one page with `forma create <space-id> --input ... --json`.
7. Verify with `forma list --space <space-id> --json` and `forma inspect <path> --json`.

Do not invent built-in domain types. Treat names such as `notes`, `tasks`, and `members` as user-defined content groups unless the workspace config defines them.

`forma knowledge health --json` may warn about isolated pages in a newly created workspace. Treat that as relationship feedback, not a failed bootstrap, unless the human expected a connected graph.
