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

## Current Baseline

As of the current starter-kit design pass, `examples/forma-starter-kit/` is the
evaluation baseline for the first public configuration shape. The example is a
user-facing guide and feature demonstration, not a test fixture and not mock
data embedded in product code.

The starter kit should be stabilized first. The backend, WebApp contracts, and
documentation should then be refactored backward from this example. Existing
implementation code and older product documentation may still lag behind this
baseline.

The current starter shape uses one root configuration entry:

```yaml
schemaVersion: 1

workspace:
    name: "Choral Forma Example"
    root: "."
    canonicalLanguage: "en"
    supportedLanguages:
        - "en"
        - "zh-Hans"
    timezone: "UTC"
    logo:
        path: "assets/logo.svg"
        alt: "Choral Forma Example"

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
            required: true
```

Important constraints:

- `.forma.yml` is the main configuration entry.
- `.forma/` is a conventional support directory, not a privileged workspace
  root.
- `.forma/dashboard.md`, `.forma/spaces/*.md`, and `.forma/views/*.md` are
  Markdown configuration nodes: frontmatter is configuration and the Markdown
  body is the node's render template.
- `<!-- forma:content -->` is the generated-content slot. If the slot is
  omitted, Forma may append generated content after the node body.
- `.forma/local/*.yml` and `.forma/local/*.md` are local-only extension points
  loaded after committed configuration files.
- Starter templates are colocated near the taxonomy that owns the create flow,
  such as `.forma/spaces/templates/todo.md`. Template files do not need a
  `kind` field.
- The starter does not use `navigation.yml`, `types.yml`, `definitions.yml`,
  `pageTypes`, `render/*.md`, or a committed persistent index.

The configured "Spaces" experience is produced by a taxonomy node at
`.forma/spaces/index.md` and term nodes such as `.forma/spaces/notes.md`. It is
not a hardcoded product concept.

Views are Markdown configuration nodes under `.forma/views/` by convention.
Ordinary projections use `source.type: pages`. Taxonomy filters use list values:

```yaml
source:
    type: pages
    taxonomy:
        spaces:
            - notes
```

View field references currently use explicit binding paths such as
`fields.title`, `fields.updatedAt`, and `fields.status`. This is a starter-kit
baseline, not a final runtime object model decision. The runtime binding model
should be revisited during the backend and WebApp refactor.

Create templates use YAML-native `!expr` tagged values in frontmatter and
`{{ ... }}` interpolation in Markdown body content:

```yaml
---
title: !expr input.title
assignees: !expr input.assignees
createdAt: !expr input.createdAt
updatedAt: !expr input.updatedAt
---
# {{ input.title }}
```

Initial transform helpers should stay small and reviewable: `trim`, `lower`,
`upper`, `default`, `join`, `yaml`, `json`, and `slugify`. More helpers should
be added only when the starter or create flows need them.

The starter demonstrates multilingual variants with `en` and `zh-Hans`.
Configuration values use BCP 47 casing such as `zh-Hans`; filename suffixes use
lowercase such as `welcome-to-choral-forma.zh-hans.md`. The
`entry-name.<language>.md` convention can identify variants without requiring
extra frontmatter. Explicit variant metadata can be added later for content
that cannot use the naming convention.

## Outdated Sections

The sections below preserve earlier starter-spec material and are due for
cleanup after the starter-kit baseline is accepted. When they conflict with
the current baseline above, the current baseline wins.

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

`forma init --name "Acme Knowledge" --language en` should create a starter
workspace from the settings-driven configuration model. The exact starter can
evolve, but the target shape is:

```text
.forma.yml
.forma/
  templates/
    note.md
    todo.md
    user.md
  views/
    notes.md
    todos.md
    users.md
assets/
notes/
todos/
users/
```

The content directories are created so editors can display the intended
workspace shape, but the starter does not need to create sample entries.
`forma init` should not require a committed index file in the first public
release. `forma serve` can build the read model in memory at startup.

## Local-Only Ignores

The starter should include local-only boundaries without making `.forma/` a
privileged hidden store. If the starter uses `.forma/` for support files, it can
commit `.forma/.gitignore` with:

```gitignore
overrides/local.yml
local/
```

## `.forma.yml`

`.forma.yml` is the main configuration entry. It owns workspace identity,
runtime values, taxonomies, views, navigation, dashboard sections, and includes.
The initialized file should contain concrete values from `forma init` inputs and
the detected current environment timezone:

```yaml
schemaVersion: 1

workspace:
    name: Acme Knowledge
    root: .
    canonicalLanguage: en
    supportedLanguages:
        - en
    timezone: Asia/Shanghai

include:
    - .forma/types.yml
    - .forma/taxonomies.yml
    - .forma/views/*.yml

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

taxonomies:
    spaces:
        title: Spaces
        mode: primary

navigation:
    - type: route
      title: Dashboard
      path: /
    - type: route
      title: Pages
      path: /pages
    - type: group
      title: Spaces
      source:
          type: taxonomy
          taxonomy: spaces
    - type: group
      title: Views
      source:
          type: views
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
explicitly in `.forma.yml`.

`forma init` is a write-heavy operation and should require explicit
confirmation. Unless the user passes `-y` or `--yes`, interactive shells should
show the resolved workspace name, language, timezone, and a summary of the
starter files and directories that will be created before asking for
confirmation. Non-interactive shells such as CI should fail without writing
files unless `-y` or `--yes` is provided.

## Included Type Configuration

Type configuration owns semantic types. P0 uses static enums and taxonomy-backed
or page-type-backed types only. A starter may keep this in `.forma/types.yml`
via the `.forma.yml` `include` list:

```yaml
schemaVersion: 1

types:
    note:
        kind: taxonomyTerm
        taxonomy: spaces
        term: notes
        input:
            transform: slugify

    todo:
        kind: taxonomyTerm
        taxonomy: spaces
        term: todos
        input:
            transform: slugify

    user:
        kind: taxonomyTerm
        taxonomy: spaces
        term: users
        input:
            transform: slugify

    todoStatus:
        kind: enum
        values:
            - todo
            - doing
            - done
```

The `user` type resolves pages classified with the `users` term. P0 must not add
a separate `username` field or a union type for assignees.

## Taxonomy Configuration

The starter "Spaces" experience should be a configured taxonomy, not a hardcoded
core partition. Schema fields use field-local `required`. Defaults live in
create inputs and templates, not in schema fields.

```yaml
schemaVersion: 1

taxonomies:
    spaces:
        title: Spaces
        mode: primary
        terms:
            notes:
                title: Notes
                description: General knowledge notes.
                include: notes/**/*.md
                template: .forma/templates/note.md
                create:
                    directory: notes
                    filename: "{{ input.slug }}.md"
                display:
                    order: 10
                conventions:
                    titleField: title
                    summaryField: summary
                    createdAtField: createdAt

            todos:
                title: Todos
                description: Lightweight action items.
                include: todos/**/*.md
                template: .forma/templates/todo.md
                create:
                    directory: todos
                    filename: "{{ input.slug }}.md"
                display:
                    order: 20
                conventions:
                    titleField: title
                    summaryField: summary
                    createdAtField: createdAt

            users:
                title: Users
                description: People who can be referenced in this workspace.
                include: users/**/*.md
                template: .forma/templates/user.md
                create:
                    directory: users
                    filename: "{{ input.slug }}.md"
                display:
                    order: 30
                conventions:
                    titleField: name
                    summaryField: description
                    createdAtField: createdAt

pageTypes:
    note:
        schema:
            type: object
            fields:
                kind:
                    type: const
                    value: note
                    required: true
                title:
                    type: string
                    required: true
                summary:
                    type: string
                createdAt:
                    type: datetime
                    required: true

    todo:
        schema:
            type: object
            fields:
                kind:
                    type: const
                    value: todo
                    required: true
                title:
                    type: string
                    required: true
                status:
                    type: enum
                    enum: todoStatus
                    required: true
                assignees:
                    type: list
                    items:
                        type: ref
                        target: user

    user:
        schema:
            type: object
            fields:
                kind:
                    type: const
                    value: user
                    required: true
                name:
                    type: string
                    required: true
                description:
                    type: string
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

P0 starter views are managed projection definitions referenced by `.forma.yml`.
The starter may store them under `.forma/views/` by convention. Views should
filter by taxonomy terms or explicit query predicates, not by a hardcoded
`entry.space` field.

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
4. Render concrete `settings.yml` values from init inputs.
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
