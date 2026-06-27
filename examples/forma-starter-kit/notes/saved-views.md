---
title: "Saved Views"
summary: "Saved views project the same Markdown workspace as lists, tables, kanban boards, or graphs."
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Saved Views

Saved views live in `.forma/views/` by convention and are included from `.forma.md`. They are Markdown configuration nodes: frontmatter defines the view and the body can place the generated projection with `<!-- forma:content -->`.

Ordinary views use `source.type: pages`, which means they project recognized pages rather than raw workspace files. Taxonomy filters use list values, so a view scoped to guide notes uses `spaces: [notes]` even when it selects only one term. View fields use explicit runtime paths such as `fields.title`, `fields.updatedAt`, and `fields.status`; create templates keep their separate `input.*` namespace.

## Included Views

| View    | File                      | Mode   | What it demonstrates             |
| ------- | ------------------------- | ------ | -------------------------------- |
| Graph   | `.forma/views/graph.md`   | graph  | Cross-space link relationships   |
| Guide   | `.forma/views/guide.md`   | graph  | Space-scoped guide relationships |
| Notes   | `.forma/views/notes.md`   | table  | Structured page inventory        |
| Recent  | `.forma/views/recent.md`  | list   | Ordered workspace reading queue  |
| Tasks   | `.forma/views/tasks.md`   | kanban | Lightweight work tracking        |
| Members | `.forma/views/members.md` | table  | Ownership and responsibility     |

## When To Use Views

Use views when a reader needs a repeatable projection over the same repository content. The source files do not move; the view decides how to browse them.

For example, [[tasks/add-team-notes|Add Team Notes]] appears as a Markdown file in the Tasks space, as a card in the kanban view, and as a recent item when it changes.
