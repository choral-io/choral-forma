---
kind: note
title: "Organize With Spaces"
summary: "Spaces are explicit partitions for notes, todos, users, or other page groups."
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Organize With Spaces

Spaces are not a hardcoded product partition. This starter kit configures `spaces` as a primary taxonomy in `.forma/spaces/index.md`, then defines each term in `.forma/spaces/*.md`:

| Space | Term file                | Includes        | Purpose                    |
| ----- | ------------------------ | --------------- | -------------------------- |
| Notes | `.forma/spaces/notes.md` | `notes/**/*.md` | Guides and knowledge pages |
| Todos | `.forma/spaces/todos.md` | `todos/**/*.md` | Lightweight action items   |
| Users | `.forma/spaces/users.md` | `users/**/*.md` | People referenced by pages |

Each term defines its own matching rule, create flow, display conventions, and term list-page template. The knowledge files remain normal Markdown with frontmatter.

## Why Spaces Matter

The configured taxonomy gives the WebApp enough structure to power:

- route-level browsing;
- page metadata;
- table and kanban views;
- user and task references;
- workspace diagnostics.

For a real team workspace, start with a small taxonomy that matches how your team already organizes knowledge. You can add other taxonomies later without making `spaces` a special built-in concept.
