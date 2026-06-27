---
scope: project
type: product
owners:
    - "members/tiscs"
tags:
    - product
    - forma
    - p0
    - starter
---

# Forma P0 Starter Specification

## Goal

Define the P0 starter workspace shape for Choral Forma.

`examples/forma-starter-kit/` is the accepted copyable example workspace baseline. Current `forma init` is bootstrap-only and does not install this starter. Future starter-kit initialization should be redesigned from the committed starter-kit or another explicit template source instead of maintaining a duplicated embedded starter.

This starter specification stays aligned with [Product direction](product-direction.md) and [Forma P0 core architecture](../decisions/forma-p0-core-architecture.md).

## Baseline

The starter baseline is include-driven and Markdown-first:

- `.forma.yml` is the single committed configuration entry point.
- `.forma/` is a conventional support directory for dashboard, spaces, templates, views, and local-only overrides. It is not a hidden workspace root or persistent store.
- Markdown under content directories remains the source of truth.
- No committed persistent index is part of the starter.
- `workspace.root` is not part of the config model and must not be generated.

The accepted starter spaces are:

- `notes`
- `tasks`
- `members`
- `guidelines`

Legacy `todos` and `users` spaces are not part of the starter baseline.

## Task Lifecycle

Starter task configuration uses these status values:

- `todo`
- `ready`
- `doing`
- `blocked`
- `reviewing`
- `done`

Starter task readiness uses these values:

- `needs-refinement`
- `ready`
- `blocked`
- `done`

`status` represents workflow state. `readiness` represents executability.

## Languages

The committed example workspace demonstrates canonical `en` content plus `zh-Hans` variants where useful for the starter tour.

Future initialization may choose a single configured language in `.forma.yml`. It does not need to generate multilingual starter content by default.

## Current Init And Future Starter Installation

Current `forma init` creates only:

- `.forma.yml`
- `.agents/skills/forma-cli/SKILL.md`

Future starter-kit installation should be derived from an explicit starter/template source and should create or copy a minimal workspace shape equivalent to:

- `.forma.yml`
- `.forma/dashboard.md`
- `.forma/spaces/index.md`
- `.forma/spaces/{notes,tasks,members,guidelines}.md`
- `.forma/spaces/templates/{note,task,member,guideline}.md`
- `.forma/views/{graph,guide,recent,notes,tasks,members}.md`
- empty or template-provided content directories for `notes`, `tasks`, `members`, and `guidelines`

Future initialization does not need to copy:

- sample notes, tasks, members, or guidelines from `examples/forma-starter-kit`
- example assets such as logo files
- workspace-level guideline pages
- a committed index or hidden state store

## Config Shape

Starter `.forma.yml` uses include-based config:

```yaml
schemaVersion: 1

workspace:
    name: Acme Knowledge
    canonicalLanguage: en
    supportedLanguages:
        - en
    timezone: UTC

include:
    - ".forma/dashboard.md"
    - ".forma/spaces/*.md"
    - ".forma/views/*.md"
    - ".forma/local/*.yml"
    - ".forma/local/*.md"

runtime:
    values:
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot
        currentUserId:
            kind: gitConfig
            key: user.name
            transform: slugify
```

`workspace.timezone` is stored explicitly. Future initialization may resolve it from the current environment when the user does not pass a timezone.

## Templates And Views

Starter space terms define the create flow directly in `.forma/spaces/*.md`, and starter templates live in `.forma/spaces/templates/`.

The starter should expose:

- note, task, member, and guideline create templates;
- a task kanban view using the status lifecycle above;
- notes and members table views;
- graph, guide, and recent-work views;
- a dashboard that surfaces workspace overview, recent pages, and knowledge health.

The generated workspace can stay empty when initialization returns. The committed example workspace remains the richer demo and smoke-validation baseline.

## Local-Only Boundary

Forma should not infer local-only status from `.gitignore`, `.forma/local/`, or any other path convention. Starter-local personal configuration should be introduced through an explicit configuration entry or future CLI option rather than hidden path semantics.

No starter behavior should depend on `.forma/` being treated as a privileged root or hidden database.
