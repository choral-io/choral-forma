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

Define the concrete P0 starter workspace created by `forma init`. The starter
should demonstrate Forma's Markdown-first knowledge model, thin spaces,
Forma Schema DSL, semantic types, create templates, and page views without
introducing P1 workflow machinery.

This specification closes the starter-content question in
[Product direction](product-direction.md) while staying inside
[Forma P0 core architecture](../decisions/forma-p0-core-architecture.md).

## Scope

The P0 starter includes only these spaces:

- `notes`: general knowledge notes.
- `todos`: lightweight action items.
- `users`: people who can be referenced by other entries.

The starter must not include:

- `groups`.
- Union semantic types.
- Lifecycle, deprecation, archive, delete, move, or rename behavior.
- `.forma/schemas/`.
- `.forma/local/` by default.
- Local overrides by default.
- Sample entries by default.
- Executable hooks, scripts, plugins, or custom template functions.

## Starter File Tree

`forma init --name "Acme Knowledge" --language en` should create this tree:

```text
.forma/
  .gitignore
  workspace.yml
  types.yml
  spaces.yml
  index.summary.json
  templates/
    note.md
    todo.md
    user.md
  views/
    notes.md
    todos.md
    users.md
notes/
todos/
users/
```

The content directories are created so editors can display the intended
workspace shape, but the starter does not create sample entries. `forma init`
should run the initial index rebuild so `.forma/index.summary.json` exists and
records zero entries for each space.

## `.forma/.gitignore`

The starter should commit `.forma/.gitignore` with local-only boundaries, while
not creating the ignored paths by default:

```gitignore
overrides/local.yml
local/
```

## `.forma/workspace.yml`

`workspace.yml` owns workspace identity and global behavior. The initialized
file should contain concrete values from `forma init` inputs and the detected
current environment timezone:

```yaml
schemaVersion: 1

workspace:
    name: Acme Knowledge
    canonicalLanguage: en
    supportedLanguages:
        - en
    timezone: Asia/Shanghai

runtime:
    values:
        currentDate:
            kind: currentDate
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot
        currentUserId:
            kind: gitConfig
            key: user.name
            transform: slugify
            required: true
```

`currentUserId` is a runtime value, not a special user system concept. If the
workspace creates an initial user entry during initialization in the future,
that entry should be produced through the ordinary `users` space create
flow.

`workspace.timezone` is an explicit workspace behavior setting. Time field
types such as `date` and `datetime` do not carry timezone metadata in the field
definition itself. Runtime values such as `currentDate` and `currentDateTime`
should use the effective workspace timezone when deriving workspace-local
values.

Persisted `date` values use `YYYY-MM-DD`. Persisted `datetime` values must be
RFC3339 timestamps with explicit timezone information, either `Z` or a numeric
offset such as `+08:00`. CLI and GUI input surfaces may accept local datetime
input without an offset, but must interpret it with `workspace.timezone` and
write an explicit RFC3339 timestamp. Offset-less persisted datetime strings
such as `2026-05-19T10:30:00` are invalid.

`forma init` may default `workspace.timezone` from the current environment's
timezone, but the generated workspace should still store the resolved timezone
explicitly in `.forma/workspace.yml`.

`forma init` is a write-heavy operation and should require explicit
confirmation. Unless the user passes `-y` or `--yes`, interactive shells should
show the resolved workspace name, language, timezone, and a summary of the
starter files and directories that will be created before asking for
confirmation. Non-interactive shells such as CI should fail without writing
files unless `-y` or `--yes` is provided.

## `.forma/types.yml`

`types.yml` owns semantic types. P0 uses static enums and space-backed
types only:

```yaml
schemaVersion: 1

types:
    note:
        kind: space
        space: notes
        input:
            transform: slugify

    todo:
        kind: space
        space: todos
        input:
            transform: slugify

    user:
        kind: space
        space: users
        input:
            transform: slugify

    todoStatus:
        kind: enum
        values:
            - todo
            - doing
            - done
```

The `user` type resolves entries from `users/`. P0 must not add a separate
`username` field or a union type for assignees.

## `.forma/spaces.yml`

`spaces.yml` owns space definitions and inline Forma Schema DSL
constraints. Schema fields use field-local `required`. Defaults live in create
inputs and templates, not in schema fields.

```yaml
schemaVersion: 1

spaces:
    notes:
        title: Notes
        description: General knowledge notes.
        include: notes/**/*.md
        template: .forma/templates/note.md
        create:
            directory: notes
            filename: "{{ input.slug }}.md"
            inputs:
                title:
                    field: title
                    required: true
                summary:
                    field: summary
                    default: ""
                slug:
                    label: Slug
                    type: string
                    default: "{{ input.title }}"
                    transform: slugify
                createdAt:
                    field: createdAt
                    default: "{{ runtime.values.currentDateTime }}"
        conventions:
            titleField: title
            summaryField: summary
            createdAtField: createdAt
        schema:
            type: object
            fields:
                kind:
                    type: const
                    value: note
                    required: true
                title:
                    type: string
                    label: Title
                    required: true
                summary:
                    type: string
                    label: Summary
                createdAt:
                    type: datetime
                    label: Created At
                    required: true
                updatedAt:
                    type: datetime
                    label: Updated At

    todos:
        title: Todos
        description: Lightweight action items.
        include: todos/**/*.md
        template: .forma/templates/todo.md
        create:
            directory: todos
            filename: "{{ input.slug }}.md"
            inputs:
                title:
                    field: title
                    required: true
                summary:
                    field: summary
                    default: ""
                slug:
                    label: Slug
                    type: string
                    default: "{{ input.title }}"
                    transform: slugify
                status:
                    field: status
                    default: todo
                createdAt:
                    field: createdAt
                    default: "{{ runtime.values.currentDateTime }}"
        conventions:
            titleField: title
            summaryField: summary
            createdAtField: createdAt
        schema:
            type: object
            fields:
                kind:
                    type: const
                    value: todo
                    required: true
                title:
                    type: string
                    label: Title
                    required: true
                summary:
                    type: string
                    label: Summary
                status:
                    type: enum
                    enum: todoStatus
                    label: Status
                    required: true
                assignees:
                    type: list
                    label: Assignees
                    items:
                        type: ref
                        target: user
                dueDate:
                    type: date
                    label: Due Date
                createdAt:
                    type: datetime
                    label: Created At
                    required: true

    users:
        title: Users
        description: People who can be referenced in this workspace.
        include: users/**/*.md
        template: .forma/templates/user.md
        create:
            directory: users
            filename: "{{ input.slug }}.md"
            inputs:
                name:
                    field: name
                    required: true
                description:
                    field: description
                    default: ""
                responsibilities:
                    field: responsibilities
                    default: ""
                slug:
                    label: Slug
                    type: string
                    default: "{{ input.name }}"
                    transform: slugify
                createdAt:
                    field: createdAt
                    default: "{{ runtime.values.currentDateTime }}"
        conventions:
            titleField: name
            summaryField: description
            createdAtField: createdAt
        schema:
            type: object
            fields:
                kind:
                    type: const
                    value: user
                    required: true
                name:
                    type: string
                    label: Name
                    required: true
                description:
                    type: string
                    label: Description
                responsibilities:
                    type: string
                    label: Responsibilities
                createdAt:
                    type: datetime
                    label: Created At
                    required: true
```

## Templates

Templates use simple `{{ ... }}` path placeholders only. They do not support
functions, filters, loops, conditionals, includes, shell execution, JavaScript,
or arbitrary expressions.

### `.forma/templates/note.md`

```markdown
---
kind: note
title: "{{ input.title }}"
summary: "{{ input.summary }}"
createdAt: "{{ input.createdAt }}"
---

# {{ input.title }}
```

### `.forma/templates/todo.md`

```markdown
---
kind: todo
title: "{{ input.title }}"
summary: "{{ input.summary }}"
status: "{{ input.status }}"
assignees: []
createdAt: "{{ input.createdAt }}"
---

# {{ input.title }}
```

### `.forma/templates/user.md`

```markdown
---
kind: user
name: "{{ input.name }}"
description: "{{ input.description }}"
responsibilities: "{{ input.responsibilities }}"
createdAt: "{{ input.createdAt }}"
---

# {{ input.name }}
```

## P0 Page Views

P0 starter views are managed Markdown definitions under `.forma/views/`.
Space starter views have `surface: page`, use the `space` shorthand
for a workspace query filtered by `entry.space`, and contain one
`<!-- forma-view -->` mount point. The starter does not include embedded views
or cross-space list, table, or kanban views.

### `.forma/views/notes.md`

```markdown
---
kind: forma-view

view:
    surface: page
    mode: table
    space: notes
    title: Notes
    description: General knowledge notes.
    table:
        columns:
            - title
            - summary
            - createdAt
    sort:
        - field: createdAt
          direction: desc
---

# Notes

<!-- forma-view -->
```

### `.forma/views/todos.md`

```markdown
---
kind: forma-view

view:
    surface: page
    mode: kanban
    space: todos
    title: Todos
    description: Lightweight action items.
    kanban:
        card:
            titleField: title
            subtitleFields:
                - summary
                - assignees
            badgeFields:
                - dueDate
        columns:
            - id: todo
              label: To Do
              query:
                  all:
                      - target: frontmatter.status
                        op: equals
                        value: todo
            - id: doing
              label: Doing
              query:
                  all:
                      - target: frontmatter.status
                        op: equals
                        value: doing
            - id: done
              label: Done
              query:
                  all:
                      - target: frontmatter.status
                        op: equals
                        value: done
---

# Todos

<!-- forma-view -->
```

P0 GUI is read-only. Kanban drag/drop mutation semantics such as `onDrop.set`
are intentionally left for a later write-capable surface.

### `.forma/views/users.md`

```markdown
---
kind: forma-view

view:
    surface: page
    mode: table
    space: users
    title: Users
    description: People referenced by this workspace.
    table:
        columns:
            - name
            - description
            - createdAt
    sort:
        - field: name
          direction: asc
---

# Users

<!-- forma-view -->
```

### Candidate `.forma/views/knowledge-graph.md`

After graph rendering and workspace-scope view sources exist, initialized
workspaces can include a built-in global graph view. This view is not a
cross-space table query; it renders the repository reference graph over a
file scope.

```markdown
---
kind: forma-view

view:
    surface: page
    mode: graph
    title: Knowledge Graph
    description: Repository-wide knowledge graph.
    source:
        kind: workspace
        include:
            - "**/*.md"
        exclude:
            - ".forma/**"
            - "**/local/**"
---

# Knowledge Graph

<!-- forma-view -->
```

## Behavior

`forma init` should:

1. Fail if `.forma/` already exists.
2. Require confirmation in CLI adapters unless `-y` or `--yes` is provided.
3. Create the starter file tree.
4. Render concrete `workspace.yml` values from init inputs.
5. Create no sample entries.
6. Create no `.forma/local/` or `.forma/overrides/local.yml`.
7. Run `forma index rebuild`.

`forma create <space>` should use the target space's create inputs,
create filename rule, and template. It should fail on path conflicts and report
that `.forma/index.summary.json` is stale after writing the new entry.

`forma serve` should expose the starter spaces and page views through the
read-only local WebApp. The P0 WebApp should guide users toward structured
navigation through views and spaces, while still providing a file
navigation mode for uncatalogued Markdown and configuration visibility. It may
inspect and render knowledge files, spaces, views, diagnostics,
configuration, file inventory, and index status, but it must not edit files or
configuration.
