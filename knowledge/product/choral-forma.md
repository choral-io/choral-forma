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

> A files-first workspace for turning everyday Markdown into durable, shared context for people and AI Agents.

## A Short Introduction

Choral Forma helps a team keep product, research, decisions, and operating knowledge in the repository where that work already happens. Instead of importing documents into a proprietary knowledge store, it works directly with ordinary Markdown and explicit workspace configuration.

The result is a knowledge base that remains readable in any editor, reviewable through normal Git workflows, and structured enough for people and Agents to navigate with confidence. Forma treats files as the source of truth while adding the capabilities that a folder of notes usually lacks: clear content groups, schemas, links, diagnostics, and useful views.

## What It Brings To Markdown

- **A durable source of truth:** keep content as versioned Markdown files rather than opaque application data.
- **Explicit structure:** define spaces, schemas, semantic types, templates, and views that match the way a workspace actually works.
- **Connected, maintainable context:** resolve links, surface relationships, and use health checks to find missing, stale, or inconsistent knowledge.
- **Multiple ways to work:** use the CLI, read-only WebApp, or editor integrations without making any one interface the owner of the content.
- **A reliable foundation for Agents:** give Agents stable paths, declared structure, and reviewable changes instead of asking them to infer context from an unstructured file tree.

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
- Agent-assisted maintenance that respects repository workflow and content-promotion boundaries.

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
