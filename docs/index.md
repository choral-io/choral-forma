---
id: index
title: Forma Documentation
summary: Product documentation entry point for using Forma.
audience:
    - human
    - agent
surfaces:
    - docs
order: 0
---

# Forma Documentation

## Overview

Forma helps teams keep repository-backed Markdown content readable, structured, and inspectable through explicit configuration.

## Abstract Core, Concrete Workflows

Forma's core model is intentionally small: workspaces, entries, spaces, schemas, templates, views, guidelines, and relations. These are building blocks, not a fixed domain model.

Start from a concrete workflow instead of from the abstract model. A workspace may organize client work, product planning, research notes, runbooks, writing projects, decisions, tasks, or something else. Those names come from the user's context and configuration; they are examples, not Forma built-ins.

## Documentation Surfaces

Product docs are the source for Human documentation, embedded docs, CLI help excerpts, and built-in Agent skill output. A docs page may include diagrams, screenshots, Mermaid charts, or other rich Markdown when that helps Human readers.

Help and skill projections must remain usable as plain text. Keep any CLI or Agent-critical instructions in stable text sections such as `## CLI Help`, `## Agent Guidance`, and `## Reference`.

## Reference

Start with `getting-started`, then use the CLI and workspace reference docs for details.
