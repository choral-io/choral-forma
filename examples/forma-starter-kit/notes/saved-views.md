---
kind: note
title: "Saved Views"
summary: "Saved views project the same Markdown workspace as lists, tables, kanban boards, or graphs."
createdAt: "2026-06-01T09:50:00+08:00"
updatedAt: "2026-06-01T09:50:00+08:00"
---

# Saved Views

Saved views live in `.forma/views/`. They are Markdown files with Forma
frontmatter, so view configuration can be reviewed and versioned with the rest
of the workspace.

## Included Views

| View   | File                     | Mode   | What it demonstrates             |
| ------ | ------------------------ | ------ | -------------------------------- |
| Graph  | `.forma/views/graph.md`  | graph  | Cross-space link relationships   |
| Guide  | `.forma/views/guide.md`  | graph  | Space-scoped guide relationships |
| Notes  | `.forma/views/notes.md`  | table  | Structured page inventory        |
| Recent | `.forma/views/recent.md` | list   | Ordered reading queue            |
| Todos  | `.forma/views/todos.md`  | kanban | Lightweight work tracking        |
| Users  | `.forma/views/users.md`  | table  | Referenced people and ownership  |

## When To Use Views

Use views when a reader needs a repeatable projection over the same repository
content. The source files do not move; the view decides how to browse them.

For example, [[todos/add-team-notes|Add Team Notes]] appears as a Markdown file
in the Todos space and as a card in the kanban view.
