---
kind: decision
title: "Keep Repository Markdown As The Source Of Truth"
summary: "Store shared knowledge in ordinary Markdown so teams can edit it in any repository-friendly tool."
status: "accepted"
owners:
  - members/mira-chen.md
reviewers:
  - members/sam-rivera.md
related_to:
  - guidelines/knowledge-capture.md
  - notes/markdown-reader.md
decidedAt: "2026-06-03T18:00:00Z"
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Keep Repository Markdown As The Source Of Truth

## Context

The starter should be easy to copy into a real workspace without introducing hidden storage, custom page formats, or editor lock-in.

## Decision

Keep shared knowledge in ordinary Markdown files. Use `.forma.yml`, space definitions, templates, and views only to describe how the workspace should be read and projected.

## Consequences

- Guide pages such as [[notes/markdown-reader|Markdown Reader]] and [[notes/create-pages|Create Pages]] can explain the model directly from repository files.
- Shared operating guidance belongs in Markdown pages such as [[guidelines/knowledge-capture|Knowledge Capture]].
- Teams can evolve the starter by editing files in their normal tools, then serving the workspace locally to review the result.
