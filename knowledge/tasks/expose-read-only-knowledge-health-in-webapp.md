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
    - "[[planning/public-read-only-release-roadmap]]"
    - "[[tasks/implement-check-index-diagnostics]]"
    - "[[tasks/implement-read-only-webapp]]"
    - "[[tasks/stabilize-public-read-only-webapp-release]]"

reported_by:
affected_area: Read-only knowledge health
---

# Expose Read-only Knowledge Health In WebApp

## Goal

Promote read-only diagnostics into a useful WebApp knowledge health surface for
the public read-only release.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/implement-check-index-diagnostics]]
- [[tasks/implement-reference-navigation-baseline]]
- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[planning/public-read-only-release-roadmap]]

## Context

A useful read-only bidirectional note application needs more than document
rendering. Users should be able to see when links are broken, references are
ambiguous, the index is stale, or notes are structurally isolated. The current
WebApp already exposes raw diagnostics, but it does not organize knowledge
health around note navigation.

The current WebApp now has route-level diagnostics panels and document-level
diagnostics in the document context panel. Those surfaces prove that diagnostics
can be displayed, but they are still closer to raw findings than to a public
knowledge health experience.

This task should organize existing and cheaply derived health signals into a
read-only surface that helps users understand what needs attention without
introducing automatic fixes or proposal workflows.

## In Scope

- Identify the minimal read-only health categories needed for a bidirectional
  note workflow, such as broken links, ambiguous links, stale index state, notes
  with no outgoing references, and notes with no backlinks.
- Reuse `check`, `index.check`, and reference navigation outputs where possible.
- Add operation result fields only if existing diagnostics do not expose enough
  structured data for the validation WebApp.
- Add a WebApp surface for viewing health findings and opening affected entries.
- Keep health findings grouped enough to be actionable without becoming a
  scoring or analytics subsystem.
- Add focused Rust or Web checks for any new contract behavior.
- Update product or architecture knowledge if health result shapes become part
  of the API contract.

## Out Of Scope

- Automatic fixes.
- Writing diagnostics or health summaries to workspace files.
- Ranking, scoring, or analytics beyond simple categories.
- Search or quick switcher behavior.
- Proposal drafting or repair actions.

## Acceptance Criteria

- Users can identify broken or ambiguous reference findings from the WebApp and
  open the affected entry when a workspace-relative path is available.
- Users can see stale-index state clearly when the index does not match source
  files.
- Users can identify entries with no outgoing references or no backlinks when
  reference data is available.
- Health categories are grouped or labeled clearly enough to distinguish
  diagnostics, unresolved references, stale index state, and weak-link signals.
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
