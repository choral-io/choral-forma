---
scope: project
type: product-brief
owners:
  - "[[groups/default-team]]"
tags:
  - product
  - choral-forma
  - knowledge
---

# Choral Forma

## Goal

Choral Forma explores a lightweight, editor-independent team knowledge application
that treats repository Markdown as the source of truth.

The product should help a team capture product context, concepts, decisions,
planning, and delivery status in explicit files and schemas instead of hiding
knowledge in a proprietary application store.

## Users

- Team members who want readable project knowledge that works in normal editors.
- Agents that need stable file paths, schemas, and workflow rules to collaborate
  safely with human maintainers.
- Future application users who need a focused interface over repository-backed
  knowledge without losing direct file access.

## Behavior

Choral Forma should preserve the repository as the durable system of record.
Application behavior, when introduced, should read from and write to explicit
Markdown files, schemas, and supporting assets under `knowledge/`.

The application should support editor-independent workflows: a person can use
the app, Foam, Obsidian, another Markdown editor, or direct repository review
without changing the underlying project facts.

## In Scope

- Markdown-first project knowledge.
- Explicit schemas for knowledge areas, task items, planning, and member
  workspaces.
- Lightweight navigation across product facts, concepts, decisions, and tasks.
- Agent-assisted maintenance that respects repository workflow rules and local
  privacy boundaries.

## Out Of Scope

- A hidden proprietary knowledge database.
- Product behavior that requires Foam, Obsidian, or editor-specific plugins as a
  source of truth.
- Application code before the product direction and architecture are captured in
  project knowledge.

## Related Concepts

- [[repository-backed-knowledge]]
- [[editor-independent-notes]]
- [[agent-assisted-knowledge-maintenance]]

## Open Questions

- Which human workflows should the first application interface make easier than
  editing Markdown directly?
- What minimum schema surface is needed before application code is introduced?
- How should the app expose review, validation, and formatting feedback without
  taking ownership away from the repository?
