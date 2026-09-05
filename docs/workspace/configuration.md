---
id: workspace.configuration
title: Workspace Configuration
summary: Define the minimal `.forma.md` and imported config node model.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
    - skill
order: 100
---

# Workspace Configuration

## Overview

`.forma.md` is the single configuration entry point. All persisted file references are workspace-relative POSIX paths resolved from the directory containing `.forma.md`.

Forma configuration is built from explicit Markdown files. The root `.forma.md` declares workspace settings and `imports` patterns in YAML frontmatter. Its Markdown body can explain the workspace for humans and Agents. Imported Markdown config nodes then define higher-level workspace behavior such as content groups, templates, views, guidelines, schemas, and runtime values.

Root `imports` loads configuration files; term and view `include` fields select content. YAML key order does not change their meaning.

Forma does not infer workspace semantics from directory names. A directory named `notes`, `tasks`, or `members` has no special meaning until a config node describes how files in that directory should be indexed, created, displayed, or checked.

## CLI Help

Start with `forma config summary --sources --json` to inspect the resolved workspace model and its sources. Use `forma config inspect --json` only to debug the authored effective configuration or when its full payload is required. Run `forma check --json` after editing `.forma.md` or imported config nodes.

## Migration Notes

Older pre-release workspaces may still use root `include` to load config files. Current Forma uses `imports` for root config imports. Change only the root `.forma.md` field name; keep `include` in term and view config nodes because those fields select content.

```yaml
imports:
    - ".forma/*.md"
    - ".forma/spaces/*.md"
    - ".forma/views/*.md"
```

If `forma check --json` reports `config.legacyRootInclude`, replace root `include` with `imports`. If it reports `config.legacyRefKind`, replace named type `kind: ref` with `kind: entryRef`.

## Reference

The minimal `.forma.md` contains `schemaVersion`, `workspace`, and `imports` in frontmatter. Add `runtime` only when templates or create defaults need a configured runtime value.

```md
---
schemaVersion: 1

workspace:
    name: "Untitled Forma Workspace"
    canonicalLanguage: "en"
    supportedLanguages:
        - "en"
    timezone: "UTC"

imports:
    - ".forma/*.md"
    - ".forma/spaces/*.md"
    - ".forma/views/*.md"
---

# Untitled Forma Workspace

This file is the Forma workspace entry point.
```

Every matching import contributes to the same effective configuration. Directory names and Git ignore rules do not give an imported file precedence, ownership, privacy, or publication meaning.

### Path Patterns

Glob patterns use workspace-relative POSIX paths. `*` and `?` match within one directory component; `**` matches across directories. These rules apply to imports, content selection, taxonomy membership, and View include/exclude filters.

For example, `people/*/notes/**/*.md` includes `people/alex/notes/current.md` and `people/alex/notes/archive/previous.md`, but not `people/alex/local/notes/private.md`. A broader explicit pattern such as `people/**/*.md` includes all three; `local` is not a reserved privacy boundary.

Earlier builds allowed `*` to cross directory separators. Replace it with `**` where recursive selection was intended, including nested configuration imports, and recheck the effective sources and path classification before sharing or exporting content.

### Runtime Values

Runtime values define named values that templates and create defaults can read with `{{ runtime.values.<name> }}`. Names are workspace-defined; provider `kind` values select built-in behavior:

| kind | Fields | Use |
| --- | --- | --- |
| `const` | `value`, optional `required`, `transform` | Explicit configured value, optionally supplied by an imported configuration fragment. |
| `gitConfig` | `key`, optional `required`, `transform` | Read a value from Git config, such as `user.name` or `user.email`. |
| `currentDate` | none | Current date in `YYYY-MM-DD`, resolved with `workspace.timezone`. |
| `currentDateTime` | none | Current datetime in RFC3339, resolved with `workspace.timezone`. |
| `workspaceRoot` | none | Workspace root path as seen by Forma. |

`transform` currently applies only to `const` and `gitConfig` values. Use `required: true` only when the operation should report an unresolved runtime value if the provider cannot resolve a value.

```yaml
runtime:
    values:
        buildTime:
            kind: currentDateTime
        authorKey:
            kind: gitConfig
            key: user.name
            transform: slugify
        label:
            kind: const
            value: Example
```

`buildTime`, `authorKey`, and `label` are example names. Declare the values a template actually uses; naming a value does not create an identity, entry, or reference.

### Named Types

Root `.forma.md` and imported `kind: types` nodes contribute to one effective `types` map. These are workspace-defined names, not Forma built-in types. See [Schemas: Named Types](schemas.md#named-types) for a complete declaration and usage example.

### Entry References

An `entryRef` named type's `source` is a workspace-relative content-group config path, not a taxonomy-qualified logical id. The `.md` extension may be omitted for that config path. A field using the type stores the workspace-relative path of an existing entry in the target group, not a bare identity value.

Create defaults and [templates](templates.md) must render that stored reference form. Resolve it from the named type's configured source and existing entries; a directory or runtime-value name alone does not define a reference target.

### Taxonomies And Content Groups

Included Markdown config nodes use frontmatter as their machine-readable configuration and Markdown body as Human-readable documentation. A taxonomy should be declared before its terms:

```yaml
---
schemaVersion: 1
kind: taxonomy
id: spaces
projection: contentGroups
title: Spaces
mode: primary
---
```

`projection: contentGroups` selects this taxonomy as the source of schema-bearing content groups. The taxonomy `id` is workspace-configured; `spaces` is only the id used by this example.

`mode: primary` means one page should match at most one term in that taxonomy; a page matching multiple terms reports a diagnostic. `mode: multiple` allows several terms in that taxonomy. A page may belong to terms from different taxonomies at the same time.

A configured content group is declared as a taxonomy term:

```yaml
---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
    - "notes/**/*.md"
create:
    directory: notes
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/note.md
    inputs:
        title:
            required: true
        slug:
            default: "{{ input.title }}"
            transform: slugify
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
---
```

`create.directory` and `create.filename` are rendered with the same create-time placeholder context. Both may reference configured `input.*` values and runtime values, and the combined rendered path must remain a workspace-relative path.

`taxonomy: spaces` must match the `id` of the taxonomy that declares `projection: contentGroups`. That projection makes the term appear in the `contentGroups` reported by `forma config summary --json`. `space`, `note`, and similar names are not built-in domain objects; they are configured patterns derived from explicit config.

### Display Metadata

Taxonomy and term config nodes may declare optional presentation hints under `display`. These hints do not change indexing or membership semantics, and every configured taxonomy uses the same contract.

```yaml
---
schemaVersion: 1
kind: taxonomy
id: areas
title: Areas
mode: multiple
display:
    order: 20
    icon: shapes
    color: "#64748B"
---
```

```yaml
---
schemaVersion: 1
kind: term
taxonomy: areas
title: Research
display:
    icon: flask-conical
    color: "#4F7CAC"
include:
    - "research/**/*.md"
---
```

- `order` is an integer sorting hint.
- `icon` is a provider-neutral Forma icon id. The supported registry is: `book-open`, `boxes`, `calendar`, `circle-check`, `ellipsis`, `eye`, `file-text`, `flask-conical`, `folder`, `folder-tree`, `kanban`, `lightbulb`, `list`, `list-checks`, `network`, `package`, `panels-top-left`, `rocket`, `shapes`, `table-properties`, `tags`, `triangle-alert`, and `users`.
- `color` must use the exact `#RRGGBB` shape. Hex digits are case-insensitive.

Clients map icon ids to their own bundled assets and adapt configured colors to the active theme. An unsupported icon produces `config.displayIconInvalid`; an invalid color produces `config.displayColorInvalid`. Invalid presentation values are omitted from the effective display metadata so clients can use their normal fallback icon and theme color. Forma does not download icons, accept icon URLs, or interpret arbitrary SVG from workspace config.

## Agent Skill

Do not infer configuration from `.gitignore` or path names. Add config nodes through explicit `imports` patterns. Before adding term nodes, make sure the referenced taxonomy has a `kind: taxonomy` config node with a matching `id`. Verify the resolved model with `forma config summary --sources --json` and `forma check --json`; use `config inspect` only to debug authored configuration.
