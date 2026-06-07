---
kind: note
title: "Organize With Spaces"
summary: "Spaces are explicit partitions for notes, todos, users, or other page types."
createdAt: "2026-06-01T09:20:00+08:00"
updatedAt: "2026-06-01T09:20:00+08:00"
---

# Organize With Spaces

Spaces describe how Forma should group Markdown files. This starter kit defines
three spaces in `.forma/spaces.yml`:

| Space | Includes        | Purpose                    |
| ----- | --------------- | -------------------------- |
| Notes | `notes/**/*.md` | Guides and knowledge pages |
| Todos | `todos/**/*.md` | Lightweight action items   |
| Users | `users/**/*.md` | People referenced by pages |

Each space can define schema fields, display conventions, and creation
templates. The files remain normal Markdown with frontmatter.

## Why Spaces Matter

Spaces give the WebApp enough structure to power:

- route-level browsing;
- page metadata;
- table and kanban views;
- user and task references;
- workspace diagnostics.

For a real team workspace, start with a small number of spaces that match how
your team already organizes knowledge.
