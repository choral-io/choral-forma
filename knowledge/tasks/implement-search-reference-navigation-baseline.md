---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - navigation
    - search

effort: M
readiness: needs-refinement
sprint:

blocked_by: []
related_to:
    - "[[tasks/implement-read-only-webapp]]"
    - "[[tasks/implement-check-index-diagnostics]]"

reported_by:
affected_area: Search and reference navigation
---

# Implement Search And Reference Navigation Baseline

## Goal

Add the first useful search and reference-navigation baseline for browsing a
Forma workspace.

## Sources

- [[discovery/mainstream-knowledge-app-feature-analysis]]
- [[product/product-direction]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/implement-read-only-webapp]]

## Context

The product direction identifies search, quick navigation, backlinks, and
broken-link diagnostics as core reading and maintenance affordances. The P0
read-only WebApp already has browsing, rendering, inspection, diagnostics, and
file navigation surfaces, but it does not yet provide a focused search or
reference navigation workflow.

This task should stay smaller than a full search/query system. The baseline is
an index-backed reading aid for the WebApp: users can quickly find known entries
and inspect the reference neighborhood of the active document. It should not
introduce a full-text engine, graph rendering, persisted diagnostic data, or
write-capable navigation actions.

## In Scope

- Add a lightweight `search.entries` operation for indexed entry search.
    - Search candidates come from the summary index, not raw Markdown body text.
    - Match against path, title, summary, collection, and kind.
    - Return workspace-relative POSIX paths, display titles, snippets or match
      fields when cheaply available, and stable empty states.
    - Keep CLI exposure optional; the P1 requirement is RPC/WebApp support.
- Add a lightweight reference-navigation operation for one entry, such as
  `references.list`.
    - Use the summary index to return outgoing references for the entry and
      backlinks from other indexed entries.
    - Include source path, source title when available, target path, intent,
      source kind, field, and semantic type when available.
    - Report unresolved or stale index conditions as diagnostics, not persisted
      diagnostic files.
- Add WebApp affordances for quick entry search and opening results in tabs.
- Replace placeholder relationship UI with real outgoing/backlink data when the
  operation can resolve it.
- Add focused tests for any changed operation or shared TypeScript contract.
- Update durable product or architecture knowledge when behavior is finalized.

## Out Of Scope

- Full-text search engine integration.
- Fuzzy search tuning beyond a simple baseline.
- Vector search.
- Interactive graph rendering.
- Cross-collection query DSL or advanced view filters.
- Editing source files from search results.
- Persisted diagnostic result files.

## Acceptance Criteria

- Users can search indexed entries from the read-only WebApp by title or path
  and open a selected result.
- Empty queries, no-result searches, stale index data, and invalid parameters
  produce clear empty states or diagnostics rather than panics.
- Users can view outgoing references and backlinks for the active entry when
  reference data is available in the summary index.
- Reference navigation results distinguish `reference`, `link`, and `embed`
  intents when the index provides that data.
- Any new operation result uses workspace-relative POSIX paths only.
- Focused Rust tests cover search matching, empty/no-result behavior, outgoing
  references, and backlinks.
- Shared TypeScript types and WebApp behavior are covered by focused type/build
  checks.
- Durable architecture or product docs describe any new RPC operation names and
  result-shape commitments.

## Relationship Notes

This task follows the read-only WebApp and check/index diagnostics work. It may
need to be split if the selected baseline requires new index data and a larger
WebApp interaction pass.

It should stay separate from `[[tasks/implement-interactive-graph-view-render]]`.
Graph can reuse the same reference-index data later, but graph rendering is a
view-mode task rather than a bottom-panel relationship navigation task.

## Open Questions

- Exact RPC names and result field names can be finalized during
  implementation, but the operation should remain read-only and index-backed.
- If the current summary index lacks display data needed for usable backlinks,
  prefer adding small deterministic index fields over scanning full Markdown
  bodies in the WebApp.
