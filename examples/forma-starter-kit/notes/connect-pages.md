---
kind: note
title: "Connect Pages"
summary: "Use Markdown links and wikilinks to create references, backlinks, and graph edges."
createdAt: "2026-06-01T09:40:00+08:00"
updatedAt: "2026-06-01T09:40:00+08:00"
---

# Connect Pages

Forma reads links from Markdown content and turns indexed pages into navigation,
references, backlinks, and graph edges.

## Internal Links

Use standard Markdown links when you want editor-agnostic portability:

- [Getting Started](notes/getting-started.md)
- [Markdown Reader](notes/markdown-reader.md)

Use wikilinks when that is natural for your local knowledge workflow:

- [[notes/welcome-to-choral-forma|Welcome to Choral Forma]]
- [[notes/saved-views|Saved Views]]
- [[todos/review-starter-workspace|Review Starter Workspace]]

## Backlinks

When another page links here, the page detail view can show it in the Backlinks
section. This helps readers discover why a page matters.

## Graph Views

Graph is a view mode, not a special global feature. This starter kit includes
`.forma/views/graph.md` for cross-space links and `.forma/views/guide.md` for
guide-page links.
