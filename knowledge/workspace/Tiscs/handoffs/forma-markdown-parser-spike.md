---
scope: member
type: handoff
owners:
  - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
  - workspace
  - handoff
  - forma
  - rust
  - markdown
---

# Forma Markdown Parser Spike

## Purpose

Hand off a focused technical spike for another Agent to evaluate Rust Markdown
parser options for Choral Forma. The main conversation will continue product and
architecture design in parallel; this handoff should let the spike proceed
without blocking that discussion.

## Source Context

Relevant project knowledge:

- [Product direction](/Users/Tiscs/Projects/choral-notes/knowledge/product/product-direction.md)
- [Forma core technical direction](/Users/Tiscs/Projects/choral-notes/knowledge/architecture/forma-core-technical-direction.md)
- [Mainstream knowledge app feature analysis](/Users/Tiscs/Projects/choral-notes/knowledge/discovery/mainstream-knowledge-app-feature-analysis.md)

Current technical direction:

- Forma core is provisionally planned in Rust.
- Forma is not Markdown-editor-first; it is parser-and-renderer-first.
- P0 should reuse existing editors for writing.
- P0 should parse and render Markdown for knowledge understanding, checks,
  indexing, and read-only GUI rendering.
- P0 should not rewrite existing Markdown bodies.
- P0 should use `FormaAST = Markdown AST + Forma extensions`.
- P0 should parse Obsidian-style embeds such as `![[note]]` as embedded
  reference intent, but render them as normal links or linked placeholders.

## Materials

Candidate Rust Markdown parser libraries:

- `markdown-rs` / crate `markdown`
- `comrak`
- `pulldown-cmark` as an event-stream fallback
- `tree-sitter-markdown` only as future context, not the primary P0 candidate

Candidate YAML/frontmatter libraries may be noted if discovered, but the primary
spike is Markdown parsing and rendering.

## Actions Requested

Create a small Rust spike that compares at least `markdown-rs` and `comrak`
against Forma's P0 needs.

Use a sample Markdown document covering:

```md
---
kind: note
title: Example
assignees:
  - "[[users/tiscs]]"
---

# Example

See [[notes/foo]] and ![[notes/bar]].

<!-- forma-view -->

<!-- forma-view: todos assignee="users/tiscs" -->

## Section

- [ ] todo marker
- [x] done marker

| A                    | B     |
| -------------------- | ----- |
| [[notes/table-link]] | value |
```

Compare these capabilities:

- Markdown AST access.
- Source position support.
- HTML comment detection.
- GFM table support.
- GFM task list support.
- Markdown-to-HTML rendering quality.
- Ease of custom wikilink and `![[...]]` scanning.
- Error reporting ergonomics.
- Rust API ergonomics.
- Crate maturity and maintenance activity.

## Decisions Made

The spike should not decide broader product scope. It should only recommend the
Markdown parser strategy for P0.

Expected recommendation categories:

- Prefer `markdown-rs`.
- Prefer `comrak`.
- Use one parser for AST and another for HTML rendering.
- Use parser plus custom scanner for wikilinks, embeds, and Forma directives.
- Defer final choice because a blocking gap remains.

## Missing Information

- Final local service and GUI design is still under discussion.
- Final index/check data structures are still under discussion.
- P0 does not yet require MCP or editor extensions, but future compatibility
  matters.

## Risks

- Do not overfit the spike to editing use cases. Forma is not trying to build a
  Markdown editor in P0.
- Do not assume parser support for Obsidian wikilinks; custom scanning may be
  acceptable.
- Do not turn the spike into a full application scaffold.

## Next Action

Run the spike and produce a short report with:

- A capability matrix.
- Minimal code or command output evidence.
- Recommendation and rationale.
- Any parser limitations that should affect FormaAST design.

## Acceptance Criteria

This handoff is complete when the receiving Agent provides a clear parser
recommendation or identifies specific blocking gaps that require further
architecture discussion.

## Response

Pending.
