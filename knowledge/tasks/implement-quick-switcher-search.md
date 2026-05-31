---
scope: project
type: task
priority: P2
severity:
value: M
module: app

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p2
    - navigation
    - search

effort: M
readiness: needs-refinement
sprint:

blocked_by:
    - "[[tasks/implement-reference-navigation-baseline]]"
related_to:
    - "[[tasks/implement-read-only-webapp]]"
    - "[[tasks/implement-interactive-graph-view-render]]"

reported_by:
affected_area: Quick navigation
---

# Implement Quick Switcher Search

## Goal

Add a lightweight quick switcher for opening indexed entries by title or path
after the read-only bidirectional note loop is usable.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/implement-read-only-webapp]]
- [[tasks/implement-reference-navigation-baseline]]

## Context

Search is useful for efficiency, but it is not the first priority for a
read-only bidirectional note application. The primary P1 loop should first make
links, backlinks, graph data, and knowledge health usable. Once that loop is in
place, a lightweight quick switcher can make entry opening faster without
introducing a full search subsystem.

The current WebApp is a validation shell. This task should validate the
operation contract and basic behavior only; a later WebApp rewrite can redesign
the interaction.

## In Scope

- Add a lightweight read-only entry search operation, such as `search.entries`.
    - Search candidates come from the summary index, not raw Markdown body text.
    - Match against path, title, summary, space, and kind.
    - Return workspace-relative POSIX paths, display titles, and simple match
      fields when cheaply available.
- Add shared TypeScript result types and client support.
- Add minimal WebApp quick-open behavior for opening a selected result.
- Add focused tests for matching, empty queries, no-result behavior, and invalid
  parameters.
- Update architecture or product knowledge if the operation name and result
  shape become contract commitments.

## Out Of Scope

- Full-text indexing.
- Fuzzy ranking beyond a simple deterministic baseline.
- Vector search.
- Search across unindexed source body text.
- Persistent search caches.
- UI polish for the current WebApp shell.

## Acceptance Criteria

- Users can search indexed entries by title or path and open a selected result.
- Empty queries, no-result searches, stale index data, and invalid parameters
  produce clear empty states or diagnostics rather than panics.
- Search results use workspace-relative POSIX paths only.
- Search ranking is deterministic for unchanged index input.
- Focused Rust tests and Web/shared type checks pass for changed behavior.

## Relationship Notes

This task is intentionally P2. It should not block reference navigation, graph
rendering, or read-only knowledge health work.

## Open Questions

- Should the first quick switcher search be exposed through CLI as well as RPC,
  or remain WebApp/RPC-only until there is script demand?
