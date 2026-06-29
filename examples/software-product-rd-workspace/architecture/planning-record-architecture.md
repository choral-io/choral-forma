---
title: "Planning Record Architecture"
summary: "Product planning records stay in Markdown files and are projected into team views without hidden state."
owners:
  - members/noah-kim
reviewers:
  - members/ava-patel
tags:
  - architecture
  - planning
createdAt: "2026-06-29T00:00:00Z"
updatedAt: "2026-06-29T00:00:00Z"
---

# Planning Record Architecture

Atlas Notes stores durable product knowledge as Markdown pages. The workspace projects those records into views such as task boards, release scope tables, and relationship graphs.

## Principles

- Markdown files remain the durable source of truth.
- Views are projections and should not invent hidden state.
- Structured fields should stay small and reviewable.
- Workflow changes should leave reviewable evidence before shared records are updated.

## Related Records

- [[product/atlas-notes]]
- [[decisions/keep-markdown-as-source-of-truth]]
- [[tasks/refine-feedback-intake]]
