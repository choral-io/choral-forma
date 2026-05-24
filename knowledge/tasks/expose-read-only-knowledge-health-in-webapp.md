---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - diagnostics
    - health

effort: M
readiness: needs-refinement
sprint:

blocked_by:
    - "[[tasks/implement-reference-navigation-baseline]]"
related_to:
    - "[[tasks/implement-check-index-diagnostics]]"
    - "[[tasks/implement-read-only-webapp]]"

reported_by:
affected_area: Read-only knowledge health
---

# Expose Read-only Knowledge Health In WebApp

## Goal

Expose read-only knowledge health signals in the validation WebApp so a user can
understand broken or weak note graph structure without leaving the local
application.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/implement-check-index-diagnostics]]
- [[tasks/implement-reference-navigation-baseline]]

## Context

A useful read-only bidirectional note application needs more than document
rendering. Users should be able to see when links are broken, references are
ambiguous, the index is stale, or notes are structurally isolated. The current
WebApp already exposes raw diagnostics, but it does not organize knowledge
health around note navigation.

The current WebApp is a validation shell and will be rebuilt in a later UI
phase. This task should focus on proving the underlying health signals and
navigation behavior rather than investing in polished WebApp design.

## In Scope

- Identify the minimal read-only health categories needed for a bidirectional
  note workflow, such as broken links, ambiguous links, stale index state, notes
  with no outgoing references, and notes with no backlinks.
- Reuse `check`, `index.check`, and reference navigation outputs where possible.
- Add operation result fields only if existing diagnostics do not expose enough
  structured data for the validation WebApp.
- Add a minimal WebApp surface for viewing health findings and opening affected
  entries.
- Add focused Rust or Web checks for any new contract behavior.
- Update product or architecture knowledge if health result shapes become part
  of the API contract.

## Out Of Scope

- Automatic fixes.
- Writing diagnostics or health summaries to workspace files.
- Ranking, scoring, or analytics beyond simple categories.
- Full UI redesign or polished dashboards.
- Search or quick switcher behavior.

## Acceptance Criteria

- Users can identify broken or ambiguous reference findings from the WebApp and
  open the affected entry when a workspace-relative path is available.
- Users can see stale-index state clearly when the index does not match source
  files.
- Users can identify entries with no outgoing references or no backlinks when
  reference data is available.
- Health information uses workspace-relative POSIX paths only.
- No health result is persisted as product state.
- Focused validation passes for changed Rust, shared TypeScript, and WebApp
  contracts.

## Relationship Notes

This task follows reference navigation because no-backlink and no-outgoing
signals need the same resolved relationship data. It should stay separate from
full graph rendering and from later write-capable repair workflows.

## Open Questions

- Should orphan or weakly linked notes be warnings, informational findings, or a
  WebApp-only derived category?
- Should health categories be represented as normalized operation output, or as
  grouped views over existing diagnostics plus `file.references` data?
