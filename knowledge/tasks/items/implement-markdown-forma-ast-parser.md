---
scope: project
type: task
owners:
  - "[[groups/default-team]]"
assignees: []
reviewers:
  - "[[groups/default-team]]"
tags:
  - forma
  - p0
  - markdown
  - parser
priority: P0
severity:
value: H
module: api
effort: M
readiness: ready
sprint:
blocked_by:
  - "[[tasks/items/scaffold-forma-workspace]]"
related_to:
  - "[[architecture/forma-core-technical-direction]]"
  - "[[workspace/Tiscs/research/forma-markdown-parser-spike-report]]"
reported_by:
affected_area: Markdown parsing and FormaAST enrichment
---

# Implement Markdown FormaAST Parser

## Goal

Implement P0 Markdown reading and FormaAST enrichment for entries and views.

## Sources

- [[architecture/forma-core-technical-direction]]
- [[decisions/forma-p0-core-architecture]]
- [[workspace/Tiscs/research/forma-markdown-parser-spike-report]]

## Context

Forma is parser-and-renderer-first, not Markdown-editor-first. P0 should split
frontmatter and body, parse YAML frontmatter, parse Markdown with the selected
AST parser, and enrich the result with Forma-specific references and
directives.

## In Scope

- Split frontmatter and Markdown body without rewriting source.
- Parse YAML frontmatter into generic values for entries and typed values for
  config where appropriate.
- Integrate the chosen Markdown AST parser.
- Detect ordinary wikilinks, Markdown links, Obsidian-style embeds, and Forma
  comment directives such as `<!-- forma-view -->`.
- Produce source locations when available and fall back to field/file locations
  when not.
- Add fixtures for valid Markdown, invalid frontmatter, wikilinks, embeds, and
  view mount comments.

## Out Of Scope

- Markdown body rewriting.
- Rich Markdown editing.
- Expanding embedded content.
- Transclusion cycle handling.

## Acceptance Criteria

- Parser fixture tests produce stable structured output.
- Obsidian-style embeds are represented as embed intent, not expanded content.
- View mount comments are detected without requiring non-Markdown syntax.
- Source location behavior is documented and tested for the parser capabilities
  available in P0.

## Relationship Notes

Blocked by workspace scaffold. Can proceed in parallel with Schema DSL after
the scaffold exists.

## Open Questions

- None.
