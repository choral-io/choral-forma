# Choral Forma Starter Kit

This workspace is a small, copyable starter for Choral Forma. It is designed to show how a team can organize notes, tasks, members, and guidelines with ordinary Markdown plus a single `.forma.yml` entry point.

If this is your first time opening the starter, begin with `notes/welcome-to-choral-forma.md` and `notes/getting-started.md`. They introduce the example and show where to start editing it for your own team.

The workspace keeps everything inspectable in the repository. Markdown files hold the content. `.forma/` holds the supporting configuration for spaces, templates, views, and the dashboard.

The example includes:

- `notes/`: guide pages that explain the product surfaces and workspace model;
- `notes/*.zh-hans.md`: Simplified Chinese variants discovered by the `entry-name.lang.md` convention;
- `tasks/`: example workflow items with ownership, review, readiness, and dependencies;
- `members/`: example member pages referenced by tasks;
- `guidelines/`: generic operating guidance for running the workspace;
- `assets/markdown-hero.png`: an image used by the reader examples;
- `.forma.yml`: the workspace configuration entry;
- `.forma/spaces/index.md`: the primary `spaces` taxonomy index page;
- `.forma/spaces/*.md`: term definitions for the configured spaces and their create flows;
- `.forma/spaces/templates/`: templates for creating new pages in the spaces taxonomy;
- `.forma/views/`: saved table, list, kanban, and graph view pages;
- `.forma/local/*.yml` and `.forma/local/*.md`: optional private configuration loaded only because this starter's `.forma.yml` explicitly includes those patterns.

Serve it locally with:

```sh
cargo run -p forma-cli -- --workspace examples/forma-starter-kit serve
```

The starter does not use a committed persistent index. The local service rebuilds its read model from the repository files.

The starter declares `en` as the canonical language and `zh-Hans` as an additional supported language. Files such as `notes/getting-started.zh-hans.md` demonstrate the built-in `entry-name.lang.md` discovery rule: the localized file is a language variant of `notes/getting-started.md`, not a separate canonical page. File paths use lowercase language tags for portability; config values use canonical BCP 47 casing.

Workspace-level guidelines live in `.forma.yml`. In this starter, workspace operations and task selection are loaded together because Agents often need those procedures before they inspect a specific page. Individual spaces can still add more specific guidance when a rule truly applies only inside that space.

Included configuration nodes use their configuration path as identity; `kind` describes how the node behaves. All persisted configuration file references are workspace-relative POSIX paths resolved from the directory that contains `.forma.yml`, regardless of the file that contains the reference.

Forma does not interpret `.gitignore` as workspace semantics. Personal or private configuration should be introduced through explicit configuration such as this starter's `.forma/local/*.yml` and `.forma/local/*.md` include patterns, or through a future `--config` style mechanism, rather than by relying on ignored path names alone. This starter's `.gitignore` keeps `.forma/local/` uncommitted for copied workspaces, but Forma loads those files only because `.forma.yml` names the patterns.

Markdown configuration nodes can use `<!-- forma:content -->` as the explicit slot for generated content such as dashboard sections, taxonomy terms, term pages, or view projections. If the slot is omitted, Forma should append the generated content after the Markdown body.

Saved views use `source.type: pages` for ordinary projections over recognized pages. Page-source views filter by higher-level semantics such as taxonomy values rather than file globs. Taxonomy filters use list values, even when matching a single term. Table columns are objects so labels and future display options can be added without changing the column shape. Runtime field bindings use explicit paths: user frontmatter fields are addressed as `fields.*`, file facts as `source.*`, primary taxonomy data as `taxonomy.*`, and full taxonomy membership as `taxonomies.*`. Queries use `field`, matching table columns and sort entries, rather than a separate `target` key. Result ordering remains a view-level `sort` block; kanban columns may define their own local `sort` because each column is a separate result group.

Create templates use simple quoted `{{ ... }}` placeholders in frontmatter and Markdown body content. Generated list or object fields can use ordinary YAML defaults from term inputs when they should stay structured values:

```yml
title: "{{ input.title }}"
assignees: []
```

The initial transform helper set should stay small. The starter currently depends on `slugify` for filename input defaults.
