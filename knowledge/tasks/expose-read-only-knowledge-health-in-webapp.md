---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - diagnostics
    - health

effort: M
status: done
readiness: ready
sprint:

blockedBy:
    - "tasks/implement-reference-navigation-baseline"
relatedTo:
    - "planning/public-read-only-release-roadmap"
    - "tasks/implement-check-index-diagnostics"
    - "tasks/implement-read-only-webapp"
    - "tasks/stabilize-public-read-only-webapp-release"

reportedBy:
affectedArea: Read-only workspace health
---

# Expose Read-only Workspace Health In WebApp

## Goal

Promote read-only diagnostics into a useful WebApp workspace health surface for the public read-only release.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/implement-check-index-diagnostics]]
- [[tasks/implement-reference-navigation-baseline]]
- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[planning/public-read-only-release-roadmap]]

## Context

A useful read-only bidirectional note application needs more than document rendering. Users should be able to see when links are broken, references are ambiguous, the index is stale, or notes are structurally isolated. The current WebApp already exposes raw diagnostics, but it does not organize workspace health around note navigation.

The current WebApp now has route-level diagnostics panels and document-level diagnostics in the document context panel. Those surfaces prove that diagnostics can be displayed, but they are still closer to raw findings than to a public workspace health experience.

This task should organize existing and cheaply derived health signals into a read-only surface that helps users understand what needs attention without introducing automatic fixes or proposal workflows.

## In Scope

- Identify the minimal read-only health categories needed for a bidirectional note workflow, such as broken links, ambiguous links, discovery diagnostics, notes with no outgoing references, and notes with no backlinks.
- Reuse `check` and reference navigation outputs where possible.
- Add operation result fields only if existing diagnostics do not expose enough structured data for the validation WebApp.
- Add a WebApp surface for viewing health findings and opening affected entries.
- Keep health findings grouped enough to be actionable without becoming a scoring or analytics subsystem.
- Add focused Rust or Web checks for any new contract behavior.
- Update product or architecture knowledge if health result shapes become part of the API contract.

## Out Of Scope

- Automatic fixes.
- Writing diagnostics or health summaries to workspace files.
- Ranking, scoring, or analytics beyond simple categories.
- Search or quick switcher behavior.
- Proposal drafting or repair actions.

## Acceptance Criteria

- Users can identify broken or ambiguous reference findings from the WebApp and open the affected entry when a workspace-relative path is available.
- Users can see discovery/config diagnostics clearly when workspace state cannot be resolved cleanly.
- Users can identify entries with no outgoing references or no backlinks when reference data is available.
- Health categories are grouped or labeled clearly enough to distinguish diagnostics, unresolved references, discovery state, and weak-link signals.
- Health information uses workspace-relative POSIX paths only.
- No health result is persisted as product state.
- Focused validation passes for changed Rust, shared TypeScript, and WebApp contracts.

## Relationship Notes

This task follows reference navigation because no-backlink and no-outgoing signals need the same resolved relationship data. It should stay separate from full graph rendering and from later write-capable repair workflows.

## Implementation Notes

- Added a shared TypeScript `workspace.health` RPC client contract so the WebApp can request normalized read-only health findings without persisting derived state.
- The WebApp dashboard now loads `workspace.dashboard` and `workspace.health` together, merges operation diagnostics for status, and exposes grouped health findings in the default Context Panel.
- Affected entries link to their existing WebApp page route when the finding path matches a dashboard entry; unresolved paths remain plain workspace-relative POSIX paths.
- The dashboard overview `Findings` metric now counts normalized health findings instead of raw operation diagnostics.

## Validation Notes

- `pnpm --filter @choral-forma/webapp check`
- `pnpm --filter @choral-forma/shared check`
- `pnpm exec vitest run packages/shared/src/index.test.ts`
- `pnpm --filter @choral-forma/webapp build`
- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit workspace health --json`
- Temporary starter-kit smoke workspace with a broken wikilink showed `Broken references`, the missing target, and a working affected-entry route in the WebApp Context Panel.

## Review Notes

- No blocking issues found in the shared RPC contract, dashboard mapping, or Context Panel rendering path.
- The implementation remains read-only: health findings are requested from `workspace.health`, displayed in WebApp state, and not persisted as product state.
- The remaining open questions are follow-up product decisions, not blockers for the public read-only release path.

## Open Questions

- Should orphan or weakly linked notes stay informational findings for the first public read-only release?
- Should the grouped Context Panel eventually get a dedicated dashboard route once the finding count grows?
