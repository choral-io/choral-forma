---
scope: project
type: product-brief
owners:
    - "members/tiscs"
tags:
    - product
    - choral-forma
    - knowledge
---

# Choral Forma

## Goal

Choral Forma explores a lightweight, editor-independent team knowledge application that treats repository Markdown as the source of truth.

The product should help teams and individuals maintain structured, normalized, versioned knowledge in explicit Markdown files and workspace configuration instead of hiding knowledge in a proprietary application store.

## Users

- Teams and individuals doing complex, process-heavy work.
- Human maintainers who want readable knowledge that works in normal editors.
- Agents that need stable file paths, schemas, views, and health checks to collaborate safely with human maintainers.
- Future application users who need a focused interface over repository-backed knowledge without losing direct file access.

## Behavior

Choral Forma should preserve the repository as the durable system of record. Application behavior, when introduced, should read from and write to explicit Markdown files, Forma configuration under `.forma/`, and user-defined content directories such as `notes/`, `tasks/`, or `members/`.

This repository's current `knowledge/` directory is the development knowledge base for Choral Forma, not the required structure of a future user workspace. It is useful dogfooding evidence, but product workspaces should be configurable rather than forced to copy this repository layout.

The application should support editor-independent workflows through Forma's built-in lightweight WebApp, CLI, and editor extensions for tools such as VS Code and Zed. People may still inspect or edit repository Markdown with other tools, but Choral Forma does not need to commit to Foam, Obsidian, or other note-app compatibility as a product contract.

## In Scope

- Markdown-first knowledge workspaces.
- Thin configurable spaces, semantic types, schemas, templates, and views.
- Lightweight navigation across user-defined knowledge entries.
- Agent-assisted maintenance that respects repository workflow rules and local privacy boundaries.

## Out Of Scope

- A hidden proprietary knowledge database.
- Product behavior that requires Foam, Obsidian, or editor-specific plugins as a source of truth or compatibility target.
- Application code before the product direction and architecture are captured in project knowledge.

## Related Concepts

- [[repository-backed-knowledge]]
- [[editor-independent-knowledge]]
- [[agent-assisted-knowledge-maintenance]]

## Related Product

- [[product-direction]]

## Open Questions

- Which human workflows should the first application interface make easier than editing Markdown directly?
- What minimum schema surface is needed before application code is introduced?
- How should the app expose review, validation, and formatting feedback without taking ownership away from the repository?
