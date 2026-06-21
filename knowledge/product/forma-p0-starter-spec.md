---
scope: project
type: product
owners: []
tags:
    - product
    - forma
    - p0
    - starter
---

# Forma P0 Starter Specification

## Goal

Define the P0 starter workspace shape for Choral Forma.

`examples/forma-starter-kit/` is the accepted copyable example workspace baseline. `forma init` should generate a smaller empty workspace that uses the same core configuration model, spaces, templates, and view semantics without copying the full sample content set.

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
- `decisions`
- `proposals`
- `guidelines`

Legacy `todos` and `users` spaces are not part of the starter baseline and must not appear in generated starter output.

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

`forma init --language <lang>` may continue to initialize a single configured language in `.forma.yml`. It does not need to generate multilingual starter content by default.

## Generated `forma init` Scope

`forma init` should create:

- `.forma.yml`
- `.forma/.gitignore`
- `.forma/dashboard.md`
- `.forma/spaces/index.md`
- `.forma/spaces/{notes,tasks,members,decisions,proposals,guidelines}.md`
- `.forma/spaces/templates/{note,task,member,decision,proposal,guideline}.md`
- `.forma/views/{graph,guide,recent,notes,tasks,members}.md`
- empty content directories for `notes`, `tasks`, `members`, `decisions`, `proposals`, and `guidelines`

`forma init` does not need to copy:

- sample notes, tasks, members, decisions, proposals, or guidelines from `examples/forma-starter-kit`
- example assets such as logo files
- workspace-level guideline pages
- a committed index or hidden state store

## Config Shape

Generated `.forma.yml` uses include-based config:

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

`workspace.timezone` is stored explicitly. `forma init` may resolve it from the current environment when the user does not pass a timezone.

## Templates And Views

Starter space terms define the create flow directly in `.forma/spaces/*.md`, and starter templates live in `.forma/spaces/templates/`.

The generated starter should expose:

- note, task, member, decision, proposal, and guideline create templates;
- a task kanban view using the status lifecycle above;
- notes and members table views;
- graph, guide, and recent-work views;
- a dashboard that surfaces workspace overview, recent pages, and knowledge health.

The generated workspace can stay empty. The committed example workspace remains the richer demo and smoke-validation baseline.

The committed example workspace may include `.forma/profiles/*.md` shared profile examples for evaluation. Generated `forma init` output does not need to create shared profiles by default, and Forma must not load a shared profile unless local personal configuration explicitly selects it by workspace-relative path.

## Local-Only Boundary

The starter should reserve `.forma/local/` for local-only overrides and keep it out of commits via `.forma/.gitignore`.

No starter behavior should depend on `.forma/` being treated as a privileged root or hidden database.
