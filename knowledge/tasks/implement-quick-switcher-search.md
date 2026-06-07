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
    - "[[planning/public-read-only-release-roadmap]]"
    - "[[tasks/implement-read-only-webapp]]"
    - "[[tasks/implement-interactive-graph-view-render]]"
    - "[[tasks/stabilize-public-read-only-webapp-release]]"

reported_by:
affected_area: Quick navigation
---

# Implement Quick Switcher Search

## Goal

Decide and implement the shared search capability behind Quick Open when it
needs to become more than dashboard-local route navigation.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/implement-read-only-webapp]]
- [[tasks/implement-reference-navigation-baseline]]
- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[planning/public-read-only-release-roadmap]]

## Context

Search is useful for efficiency, but it is not the first priority for a
read-only bidirectional note application. The primary P1 loop should first make
links, backlinks, graph data, and knowledge health usable. Once that loop is in
place, a lightweight quick switcher can make entry opening faster without
introducing a full search subsystem.

The current WebApp already has a Quick Open dialog in the sidebar. That
implementation searches route, space, document, and view candidates already
loaded in the dashboard read model. This is useful as a navigation affordance,
but it is not a shared search operation and should not be described as full-text
search.

For the first public release, Quick Open can remain dashboard-local if it is
positioned only as route and entry navigation. If it becomes a public search
feature, this task should introduce the shared `search.entries` operation.

## In Scope

- Add a lightweight read-only entry search operation, such as `search.entries`.
    - Search candidates come from the summary index, not raw Markdown body text.
    - Match against path, title, summary, space, and kind.
    - Return workspace-relative POSIX paths, display titles, and simple match
      fields when cheaply available.
- Add shared TypeScript result types and client support.
- Connect Quick Open to the shared operation when the operation is added.
- Preserve the current dashboard-local Quick Open behavior if shared search is
  deferred.
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
rendering, read-only knowledge health work, or the first public release unless
Quick Open is promoted from navigation affordance to search feature.

## Open Questions

- Should the first quick switcher search be exposed through CLI as well as RPC,
  or remain WebApp/RPC-only until there is script demand?
- Should the first public release keep dashboard-local Quick Open and defer
  `search.entries`?
