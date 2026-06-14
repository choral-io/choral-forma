# Choral Forma Starter Kit

This workspace is a small, user-facing starter example for Choral Forma. It is designed to be opened in the read-only WebApp as a guide, setup reference, and feature demonstration.

If this is your first time opening the starter, begin with `notes/welcome-to-choral-forma.md` and `notes/getting-started.md`. The rest of this README is a compact technical reference for the workspace layout and configuration shape.

This starter currently represents the target public configuration model. The CLI and WebApp will be refactored next to consume this `.forma.yml` model directly.

It uses ordinary Markdown files plus one explicit `.forma.yml` configuration entry. Supporting templates, taxonomy definitions, dashboard content, and saved views live under `.forma/` by convention, but `.forma/` is just a normal support directory.

The example includes:

- `notes/`: guide pages that explain the product surfaces;
- `notes/*.zh-hans.md`: Simplified Chinese variants discovered by the `entry-name.lang.md` convention;
- `todos/`: lightweight onboarding tasks for the kanban view;
- `users/`: example people referenced by tasks and pages;
- `assets/markdown-hero.png`: an image used by the reader examples;
- `.forma.yml`: the workspace configuration entry;
- `.forma/spaces/index.md`: the primary `spaces` taxonomy index page;
- `.forma/spaces/*.md`: term definitions for Notes, Todos, and Users, including their list-page templates;
- `.forma/spaces/templates/`: templates for creating new pages in the spaces taxonomy;
- `.forma/views/`: saved table, list, kanban, and graph view pages;
- `.forma/local/*.yml` and `.forma/local/*.md`: local-only configuration nodes loaded after committed configuration.

Serve it locally with:

```sh
cargo run -p forma-cli -- --workspace examples/forma-starter-kit serve
```

The target public release should build its read model by scanning this workspace at serve time. The starter does not require a committed persistent index.

The WebApp owns navigation composition. It can derive the default sidebar from system routes, configured taxonomies, and configured views; the service configuration does not need a navigation node.

The starter declares `en` as the canonical language and `zh-Hans` as an additional supported language. Files such as `notes/getting-started.zh-hans.md` demonstrate the built-in `entry-name.lang.md` discovery rule: the localized file is a language variant of `notes/getting-started.md`, not a separate canonical page. File paths use lowercase language tags for portability; config values use canonical BCP 47 casing.

Included configuration nodes use their configuration path as identity; `kind` describes how the node behaves. Local configuration files use the same node kinds as committed configuration files; their special behavior is load order and local-only storage. They are loaded after committed configuration, so local nodes can add personal views or taxonomy terms without changing the team workspace. If a future local node needs to replace a committed node, it should do so through an explicit target identity rather than by relying on the local file path. Starter local configuration intentionally scans only one directory level so local template or snippet files under nested folders are not loaded as configuration nodes.

Markdown configuration nodes can use `<!-- forma:content -->` as the explicit slot for generated content such as dashboard sections, taxonomy terms, term pages, or view projections. If the slot is omitted, Forma should append the generated content after the Markdown body.

Saved views use `source.type: pages` for ordinary projections over recognized pages. Page-source views filter by higher-level semantics such as taxonomy values rather than file globs. Taxonomy filters use list values, even when matching a single term. Table columns are objects so labels and future display options can be added without changing the column shape. Runtime field bindings use explicit paths: user frontmatter fields are addressed as `fields.*`, file facts as `source.*`, primary taxonomy data as `taxonomy.*`, and full taxonomy membership as `taxonomies.*`. Queries use `field`, matching table columns and sort entries, rather than a separate `target` key. Result ordering remains a view-level `sort` block; kanban columns may define their own local `sort` because each column is a separate result group.

Create templates use YAML-native `!expr` tagged values in frontmatter and `{{ ... }}` text interpolation in Markdown body content. This keeps unrendered templates valid YAML while avoiding quote-removal or indentation tricks:

```yml
title: !expr input.title
assignees: !expr input.assignees
```

The expression result replaces the whole tagged node, so arrays and objects can be written without text-level indentation tricks. The initial expression helper set should stay small:

- `trim`: remove leading and trailing whitespace.
- `lower`: convert text to lowercase.
- `upper`: convert text to uppercase.
- `default`: provide a fallback for empty values.
- `join`: render list values with a separator.
- `yaml`: render a value as a YAML node.
- `json`: render a value as JSON.
- `slugify`: convert display text into a path-friendly slug.
