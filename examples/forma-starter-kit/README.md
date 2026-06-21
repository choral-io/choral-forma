# Choral Forma Starter Kit

This workspace is a small, copyable starter for Choral Forma. It is designed to show how a team can organize notes, tasks, members, decisions, proposals, and guidelines with ordinary Markdown plus a single `.forma.yml` entry point.

If this is your first time opening the starter, begin with `notes/welcome-to-choral-forma.md` and `notes/getting-started.md`. They introduce the example and show where to start editing it for your own team.

The workspace keeps everything inspectable in the repository. Markdown files hold the content. `.forma/` holds the supporting configuration for spaces, templates, views, and the dashboard.

The example includes:

- `notes/`: guide pages that explain the product surfaces and workspace model;
- `notes/*.zh-hans.md`: Simplified Chinese variants discovered by the `entry-name.lang.md` convention;
- `tasks/`: example workflow items with ownership, review, readiness, and dependencies;
- `members/`: example member profiles referenced by tasks and proposals;
- `decisions/`: short decision records for the starter workspace model;
- `proposals/`: reviewable proposed changes before they become canonical notes or decisions;
- `guidelines/`: generic operating guidance for running the workspace;
- `assets/markdown-hero.png`: an image used by the reader examples;
- `.forma.yml`: the workspace configuration entry;
- `.forma/spaces/index.md`: the primary `spaces` taxonomy index page;
- `.forma/spaces/*.md`: term definitions for the configured spaces and their create flows;
- `.forma/spaces/templates/`: templates for creating new pages in the spaces taxonomy;
- `.forma/views/`: saved table, list, kanban, and graph view pages;
- `.forma/profiles/`: committed shared profile examples that are never loaded automatically;
- `.forma/local/profile.yml`: optional local-only profile selector loaded after committed configuration when present.

Serve it locally with:

```sh
cargo run -p forma-cli -- --workspace examples/forma-starter-kit serve
```

The starter does not use a committed persistent index. The local service rebuilds its read model from the repository files.

The starter declares `en` as the canonical language and `zh-Hans` as an additional supported language. Files such as `notes/getting-started.zh-hans.md` demonstrate the built-in `entry-name.lang.md` discovery rule: the localized file is a language variant of `notes/getting-started.md`, not a separate canonical page. File paths use lowercase language tags for portability; config values use canonical BCP 47 casing.

Workspace-level guidelines live in `.forma.yml`, and individual spaces can add more specific guidance. In this starter, the Tasks space adds task-selection guidance on top of the general workspace operations and knowledge-capture notes.

Included configuration nodes use their configuration path as identity; `kind` describes how the node behaves. All persisted configuration file references are workspace-relative POSIX paths resolved from the directory that contains `.forma.yml`, regardless of the file that contains the reference.

Shared profiles under `.forma/profiles/` are committed configuration fragments, not member, group, user, or Agent identities. Forma should not guess which shared profile to load. A local personal profile selector can explicitly select one or more profiles by workspace-relative path:

```yml
# .forma/local/profile.yml
schemaVersion: 1

profiles:
  use:
    - ".forma/profiles/reviewer.md"
```

Profiles can use other profiles through the same workspace-relative path syntax:

```yml
---
schemaVersion: 1
kind: profile
title: Reviewer
use:
  - ".forma/profiles/evidence-review.md"
---
```

The intended effective order is shared workspace config, selected shared profiles in dependency order, local personal overrides, then runtime values. Local personal overrides still win over selected shared profiles.

Markdown configuration nodes can use `<!-- forma:content -->` as the explicit slot for generated content such as dashboard sections, taxonomy terms, term pages, or view projections. If the slot is omitted, Forma should append the generated content after the Markdown body.

Saved views use `source.type: pages` for ordinary projections over recognized pages. Page-source views filter by higher-level semantics such as taxonomy values rather than file globs. Taxonomy filters use list values, even when matching a single term. Table columns are objects so labels and future display options can be added without changing the column shape. Runtime field bindings use explicit paths: user frontmatter fields are addressed as `fields.*`, file facts as `source.*`, primary taxonomy data as `taxonomy.*`, and full taxonomy membership as `taxonomies.*`. Queries use `field`, matching table columns and sort entries, rather than a separate `target` key. Result ordering remains a view-level `sort` block; kanban columns may define their own local `sort` because each column is a separate result group.

Create templates use simple quoted `{{ ... }}` placeholders in frontmatter and Markdown body content. Generated list or object fields can use ordinary YAML defaults from term inputs when they should stay structured values:

```yml
title: "{{ input.title }}"
assignees: []
```

The initial transform helper set should stay small. The starter currently depends on `slugify` for filename input defaults.
