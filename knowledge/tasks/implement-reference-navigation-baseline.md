---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - navigation
    - references

effort: M
status: done
readiness: needs-refinement
sprint:

blocked_by: []
related_to:
    - "tasks/implement-read-only-webapp"
    - "tasks/implement-check-index-diagnostics"

reported_by:
affected_area: Reference navigation
---

# Implement Reference Navigation Baseline

## Goal

Add the first useful reference-navigation baseline for browsing a Forma workspace as a read-only bidirectional note application.

## Sources

- [[discovery/mainstream-knowledge-app-feature-analysis]]
- [[product/product-direction]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/implement-read-only-webapp]]

## Context

The product direction identifies backlinks, outgoing links, graph navigation, and broken-link diagnostics as core reading and maintenance affordances. The P0 read-only WebApp already has browsing, rendering, inspection, diagnostics, and file navigation surfaces, but it does not yet provide a real reference navigation workflow.

This task should stay smaller than a full note-app UI pass. The baseline is an runtime-discovery-backed reading aid for the current validation WebApp: users can inspect the reference neighborhood of the active document and navigate to related entries. It should not introduce a full-text engine, graph rendering, persisted diagnostic data, persistent index artifacts, or write-capable navigation actions.

## In Scope

- Add a lightweight `file.references` operation for one entry.
    - Use runtime discovery and in-memory projections to return outgoing references for the entry and backlinks from other discovered entries.
    - Include source path, source title when available, target path, target title when available, intent, source kind, field, and semantic type when available.
    - Report unresolved reference or discovery conditions as diagnostics, not persisted diagnostic files.
- Add shared TypeScript result types and client support for `file.references`.
- Replace placeholder relationship UI with real outgoing/backlink data when the operation can resolve it.
- Let users open referenced entries from the validation WebApp.
- Add focused tests for any changed operation or shared TypeScript contract.
- Update durable product or architecture knowledge when behavior is finalized.

## Out Of Scope

- Full-text search engine integration.
- Quick switcher or title/path search.
- Fuzzy search tuning beyond a simple baseline.
- Vector search.
- Interactive graph rendering.
- Cross-space query DSL or advanced view filters.
- Editing source files from search results.
- Persisted diagnostic result files.

## Acceptance Criteria

- Users can view outgoing references and backlinks for the active entry when reference data is available from runtime discovery.
- Reference navigation results distinguish `reference`, `link`, and `embed` intents when discovery provides that data.
- Any new operation result uses workspace-relative POSIX paths only.
- Missing entries, entries with no references, discovery diagnostics, and invalid parameters produce clear empty states or diagnostics rather than panics.
- Focused Rust tests cover outgoing references, backlinks, empty results, and invalid entry paths.
- Shared TypeScript types and WebApp behavior are covered by focused type/build checks.
- Durable architecture or product docs describe any new RPC operation names and result-shape commitments.

## Validation Notes

- Implemented `file.references` as a runtime-discovery-backed read-only operation.
- Added shared TypeScript `FileReferencesResult` and client support through `listFileReferences`.
- Replaced the validation WebApp reference placeholder with outgoing reference and backlink groups for the active knowledge file.
- Preserved workspace-relative POSIX paths in operation results.
- Covered outgoing references, backlinks, empty results, and invalid paths with focused Rust tests.
- Verified on 2026-05-24:
    - `cargo test -p forma-core file_references`
    - `cargo test -p forma-rpc file_references`
    - `mise run check:web`

## Relationship Notes

This task follows the read-only WebApp and check/index diagnostics work. It may need to be split if the selected baseline requires new runtime discovery data.

It should stay separate from `[[tasks/implement-interactive-graph-view-render]]`. Graph can reuse the same reference projection data later, but graph rendering is a view-mode task rather than a bottom-panel relationship navigation task. Search and quick switching are later efficiency features, not prerequisites for the read-only bidirectional note loop.

## Open Questions

- Exact result field names can be finalized during implementation, but the operation should remain read-only and runtime-discovery-backed.
- If the current discovery projection lacks display data needed for usable backlinks, prefer adding small deterministic projection fields over scanning full Markdown bodies in the WebApp.
