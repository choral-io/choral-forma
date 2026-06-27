---
title: "Organize With Spaces"
summary: "Spaces are explicit partitions for notes, tasks, members, and other shared page groups."
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Organize With Spaces

Spaces are not a hardcoded product partition. This starter kit configures `spaces` as a primary taxonomy in `.forma/spaces/index.md`, then defines each term in `.forma/spaces/*.md`:

| Space      | Term file                     | Includes             | Purpose                           |
| ---------- | ----------------------------- | -------------------- | --------------------------------- |
| Notes      | `.forma/spaces/notes.md`      | `notes/**/*.md`      | Guides and reference pages        |
| Tasks      | `.forma/spaces/tasks.md`      | `tasks/**/*.md`      | Work items with owners and status |
| Members    | `.forma/spaces/members.md`    | `members/**/*.md`    | People referenced by tasks        |
| Guidelines | `.forma/spaces/guidelines.md` | `guidelines/**/*.md` | Shared operating guidance         |

Each term defines its own matching rule, create flow, display conventions, and list-page template. The content files remain normal Markdown with frontmatter.

## Why Spaces Matter

The configured taxonomy gives the WebApp enough structure to power:

- route-level browsing;
- page metadata;
- table and kanban views;
- member and task references;
- workspace diagnostics.

For a real team workspace, start with a small taxonomy that matches how your team already organizes durable content. You can add other taxonomies later without making `spaces` a special built-in concept.

In this starter, the spaces also reinforce a practical workflow: tasks can refer to [[members/mira-chen|members]], and shared guidelines such as [[guidelines/task-selection|Task Selection]] stay close to the work they shape.
