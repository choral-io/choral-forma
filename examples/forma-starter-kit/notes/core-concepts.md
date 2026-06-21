---
kind: note
title: "Core Concepts"
summary: "A quick map of the main Choral Forma ideas used by this starter workspace."
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Core Concepts

Choral Forma starts with ordinary Markdown files and adds just enough structure for a read-only knowledge browser.

## Page

A page is a Markdown file that Forma can recognize, index, and render. Pages keep their content in the repository, so they remain usable in normal editors.

## Taxonomy

A taxonomy is a configured way to classify pages. This starter configures a primary taxonomy named `spaces`, but Spaces are not a hardcoded product primitive.

## Term

A term is one value inside a taxonomy. In this starter, `notes`, `tasks`, `members`, `decisions`, `proposals`, and `guidelines` are terms of the `spaces` taxonomy. [[notes/organize-with-spaces|Organize With Spaces]] shows how they work together.

## View

A view is a saved projection over pages. The same Markdown files can appear as a table, list, kanban board, or graph without moving the source files. [[notes/saved-views|Saved Views]] walks through the included examples.

## Reference

References come from ordinary Markdown links and wikilinks. They power outgoing links, backlinks, and graph edges.

## Template

Templates describe how new pages can be created. They live near the taxonomy term that owns the create flow and use inputs such as `title`, `summary`, or `status`. [[notes/create-pages|Create Pages]] points to the task, proposal, and guideline templates in this starter.

## Variant

A variant is another language version of the same page. This starter uses files such as `welcome-to-choral-forma.zh-hans.md` to demonstrate the built-in language suffix convention.
