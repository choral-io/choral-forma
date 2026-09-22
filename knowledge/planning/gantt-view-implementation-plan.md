---
schemaVersion: 1
scope: project
type: execution-plan
title: Gantt View Implementation Plan
summary: File-level work slices, acceptance criteria, and compatibility notes for implementing the Gantt temporal View contract.
owners: []
reviewers: []
tags:
    - gantt
    - views
    - planning
sources:
    - proposals/gantt-temporal-view-contract
    - design/gantt-view-validation-2026-09-22
    - tasks/validate-lightweight-gantt-view
---

# Gantt View Implementation Plan

## Status

Stage D of [[tasks/validate-lightweight-gantt-view]]. The user gave go on 2026-09-22 after reviewing the contract, confirming day resolution as sufficient and accepting the connector scope once the feasibility spike showed no architectural risk.

This plan was authored as **proposed**. The user subsequently authorized implementation on 2026-09-22. That authorization does not create implementation Tasks, change Task lifecycle metadata, accept the product, or authorize a commit. The independent follow-up review is recorded in [[proposals/gantt-temporal-view-contract]]. Implementation evidence and remaining verification boundaries are recorded below.

Every behavioral rule referenced below lives in the contract. This document adds only sequencing, file boundaries, and per-slice acceptance criteria.

## Sequencing Principles

Core first, because every surface depends on the projection and Core carries no interaction risk. Each slice leaves the repository working and green, so a slice can be reviewed and landed on its own. Behavior-preserving refactors are separated from behavior changes, so a reviewer never has to disentangle the two. No slice adds a runtime dependency.

Slices 1 through 4 are contract plumbing with no visible product change. Slice 5 makes Gantt readable everywhere. Slice 6 is the timeline. Slices 7 and 8 are additive.

## Slice 1 — Extract the Core temporal module

Behavior-preserving refactor. Gantt is now the second real consumer, which is the condition the contract set for this extraction; doing it as its own slice keeps the Gantt diff free of Calendar churn.

| Files | Change |
| --- | --- |
| `crates/forma-core/src/render/temporal.rs` | New. Civil-date parsing, offset-instant parsing, endpoint normalization, civil-span derivation, and structured failures |
| `crates/forma-core/src/render/calendar.rs` | Consume the module; keep Calendar-specific binding, diagnostics, and projection assembly local |
| `crates/forma-core/src/render.rs` | Module declaration only |

The module accepts the loaded model, configuration, and explicit bindings, returns normalized values plus structured failures, and performs no workspace loading or filesystem traversal. It owns no diagnostic codes: each adapter maps failures into its own namespace.

**Acceptance**

- [ ] All ten existing Calendar integration tests in `crates/forma-core/tests/calendar_view.rs` pass unmodified.
- [ ] `forma view render` over the getting-started Calendar view produces byte-identical JSON before and after the refactor.
- [ ] No public API surface changes; `crates/forma-core/src/lib.rs` exports are untouched.
- [ ] `cargo test -p forma-core` passes.

## Slice 2 — Core Gantt projection

The substantive slice. Everything in the contract's Schema Binding, Intervals, Dependency Semantics, Projection, and Diagnostics sections lands here.

| Files | Change |
| --- | --- |
| `crates/forma-core/src/render/gantt.rs` | New. Definition and binding parsing with `deny_unknown_fields`; milestone boolean binding; dependency binding resolution; per-item classification with the contract's precedence; deterministic edge dedup on `(from, to)`; self-edge drop; cycle detection over every selected candidate, not only rows; the normalised `nodes` plus `rows` projection; collapsed binding diagnostics with the ten-sample cap |
| `crates/forma-core/src/render.rs` | `ViewRenderOutput::Gantt` union member; three dispatch sites — the render-required mode allowlist, `view_definition_is_valid`, and the mode match inside `render_view_definition`; re-exports |
| `crates/forma-core/src/lib.rs` | Export Gantt projection types alongside the Calendar ones |
| `crates/forma-core/tests/gantt_view.rs` | New. Oracle coverage |

Two implementation details are non-negotiable because measurement showed the alternatives are wrong. Resolved targets are counted from **index references**, which retain duplicates, never from deduplicated edges. Selection membership is checked **before** temporal usability, so a target outside the selected set is never inspected.

**Acceptance**

- [ ] Every row in the contract's Verification Cases table produces the stated result.
- [ ] `declared` equals listed predecessors plus `outsideSelection` plus `unresolved` plus `duplicates` plus `selfReferences`, asserted for every node in every fixture, with explicit cases for a repeated self reference, a repeated outside-selection target, and a repeated unresolved target.
- [ ] `candidates` equals the `nodes` length and equals `scheduled` plus `unscheduled` plus `invalid`, with `scheduled` equal to the row count.
- [ ] Every edge endpoint resolves to a node, including edges through unscheduled and temporally invalid entries.
- [ ] An edge is anchored only when both endpoints are scheduled; test each unscheduled/invalid endpoint direction. IDs use compact JSON pairs, including paths containing `->`; predecessor and edge ordering is deterministic.
- [ ] Cycle diagnostics report complete strongly connected components, including overlapping cycles, not only DFS back-edge paths.
- [ ] Missing/null, scalar, malformed list items, exact nested-field matching, interleaved unresolved references, and unsupported binding types follow the contract; unrelated fields never contribute dependencies.
- [ ] Date-only intervals and points on `9999-12-31` remain invalid; an interval ending at local midnight at that exclusive boundary can remain valid. Include year-zero, lower-bound timezone conversion, and normalization overflow cases without changing Calendar behavior.
- [ ] A cycle passing through an unscheduled or invalid entry is detected.
- [ ] No conflict between a declared relation and the dates is computed or reported anywhere.
- [ ] The projection example in the contract is reproduced exactly from an equivalent fixture, invariants included.
- [ ] A target excluded by source or query contributes a count only; its path, title, and label appear nowhere in the output.
- [ ] Binding-type failures sharing a code, bound field, and reason collapse into one View-level diagnostic carrying an affected-candidate count plus at most ten path-ordered candidate samples.
- [ ] A duplicate declaration yields one edge and is not reported as unresolved.
- [ ] A self reference is diagnosed, its edge dropped, and its row and interval retained.
- [ ] A cycle is reported with participating paths in stable order, with no row dropped and no row order changed.
- [ ] Calendar projections, ordering, diagnostics, and tests are unchanged.
- [ ] `cargo test -p forma-core` passes.

## Slice 3 — Shared wire types

| Files | Change |
| --- | --- |
| `packages/shared/src/gantt.ts` | New. Projection types plus pure range and dependency label helpers taking explicit timezone and locale, mirroring the Calendar display-helper boundary |
| `packages/shared/src/index.ts` | Re-export; add the union member |
| `packages/shared/src/gantt.test.ts` | New |

**Acceptance**

- [ ] Types match Core serialization exactly, verified by parsing a committed Core JSON fixture rather than a hand-written literal.
- [ ] `packages/shared` still declares no runtime dependency.
- [ ] Labels are deterministic for explicit timezone/locale inputs. Interactive hosts pass UI locale with workspace canonical-language fallback; static output uses that fallback explicitly and never the build machine's locale.
- [ ] `pnpm --filter @choral-forma/shared check` passes.

## Slice 4 — Consumer dispatch

No visible product change. This slice only teaches every consumer that the projection exists, so the later slices cannot accidentally rely on a Table fallback.

| File                                                  | Site                                                  |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `packages/webapp/src/data/workspace-client.ts`        | Projection `kind` union and the projection type union |
| `packages/webapp/src/data/rpc-workspace-client.ts`    | Projection mapper and the supported-mode predicate    |
| `packages/webapp/src/data/static-workspace-client.ts` | Projection mapper and the supported-mode predicate    |

**Acceptance**

- [ ] Gantt never maps onto Table on any path.
- [ ] An unrecognized projection kind still produces the explicit unsupported message.
- [ ] Existing client tests pass; new cases cover a Gantt payload through both clients.

## Slice 5 — Static HTML and VS Code

Both surfaces render a complete, deterministic interval and predecessor list. Neither promises timeline geometry.

| File | Site |
| --- | --- |
| `crates/forma-cli/src/static_html.rs` | New `ViewRenderOutput::Gantt` arm beside the Calendar arm |
| `extensions/vscode/src/preview-renderer.ts` | New `case "gantt"` beside the Calendar case, using the shared formatter |

**Acceptance**

- [ ] Output is deterministic: two builds of the same input are byte-identical.
- [ ] Output does not depend on the build date.
- [ ] Titles and labels are escaped.
- [ ] Unavailable targets produce no broken links; outside-selection and unresolved counts are stated without naming the target.
- [ ] Every node, including unscheduled and invalid entries, and its predecessors is present; nothing is truncated. Temporal rows join by path, not array position.
- [ ] `cargo test -p forma-cli` and the VS Code renderer tests pass.

## Slice 6 — WebApp timeline

The largest slice, and the one whose rules are already measured. Everything here is specified in the contract's Rendering and Surface Capabilities section.

| Files | Change |
| --- | --- |
| `packages/webapp/src/features/dashboard/gantt-layout.ts` | New. Fixed-epoch column arithmetic, range extension with both hard limits, row and day-label windowing, all feature-local and independent of React |
| `packages/webapp/src/features/dashboard/ViewGanttProjection.tsx` | New. Lazy-loaded timeline component |
| `packages/webapp/src/features/dashboard/gantt-layout.test.ts` | New |
| `packages/webapp/src/features/dashboard/DashboardHome.tsx` | Lazy import, projection dispatch, and the candidate-count branch |

**Acceptance**

- [ ] Exactly one scroll owner; zero nested scroll containers inside the timeline.
- [ ] Title column and date header are sticky on their respective axes within that one scroller.
- [ ] Bars are positioned against a fixed epoch through CSS variables, so extending the range does not move any bar.
- [ ] Day ticks come from a repeating gradient; node count does not grow with rows multiplied by days.
- [ ] Rows and day labels are both windowed; extension cost and node count stay flat as the range grows.
- [ ] Row titles are single-line and truncated, so row height is fixed.
- [ ] `role="grid"` with `aria-rowcount` over the full row list; each rendered row carries its true `aria-rowindex`; the title cell is a `rowheader` and the track a `gridcell` whose accessible name states title and date range; spacers are `role="presentation"` and `aria-hidden`.
- [ ] Arrow, page, home, and end keys reach every row, scrolling the target into the window; focus is never lost.
- [ ] Focus restoration lives in the render path, not in the navigation helper.
- [ ] Content that does not depend on the range is not rebuilt when the range changes.
- [ ] The complete node list, including invalid/unscheduled entries and all predecessor lists, is reachable at every width, not only on narrow screens.
- [ ] No wheel-level axis lock is introduced.
- [ ] Any sticky element other than the title column offsets its sticky position by the title column width.
- [ ] Extension stops at the exclusive temporal bounds and at a conservative materialized-size budget verified in Chromium, Firefox, and WebKit, including sticky-column width and vertical extent; actual layout dimensions are checked for clamping.
- [ ] A date jump outside the supported domain is rejected with the control unchanged.
- [ ] Over-budget date jumps and day-width changes are rejected atomically with prior viewport/control state preserved and an explanation. Initial oversized data tries smaller offered day widths, then falls back to the complete node list if none fits; no distant bars are silently lost.
- [ ] Extending at the left advances the scroll offset by exactly the width gained, in the same frame.
- [ ] The header remains unambiguous across year boundaries.
- [ ] No root horizontal overflow at 1440, 1024, 768, and 390 px in both themes; clean browser console.
- [ ] Visual validation follows [[guidelines/webapp-engineering-and-visual-validation]] against a non-trivial workspace, not the shortest fixture.

## Slice 7 — Selected-row connectors

Additive and independently revertible. The predecessor list is the baseline and must already be complete before this lands.

| File                                                             | Change                                          |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `packages/webapp/src/features/dashboard/ViewGanttProjection.tsx` | Inline SVG overlay for the selected row's edges |

Geometry comes from row index and date offset arithmetic, never from element rectangles. The spike measured this accurate to 1 px at a 32,428 px scroll depth, which is what makes connectors compatible with row windowing.

**Acceptance**

- [ ] This initial slice may omit off-window connectors but retains their navigable list entries and anchored status. An unanchored edge never draws a connector, regardless of which endpoint lacks an interval.
- [ ] Geometry uses arithmetic, not `getBoundingClientRect`.
- [ ] Removing this slice leaves a working timeline with complete dependency lists.
- [ ] All-edge rendering is not attempted; the spike showed 99.2 percent of edges at 5000 rows would join points that cannot share a screen.

## Slice 8 — Fixtures, documentation, examples

| Files | Change |
| --- | --- |
| `examples/getting-started-workspace/.forma/views/` | A Gantt view over the existing configured Tasks, without inventing new date fields for entries that have none |
| `docs/workspace/views.md` | A Gantt section beside Calendar |
| `docs/cli/view.md`, `docs/workspace/configuration.md` | Update wherever View modes are enumerated |

**Acceptance**

- [ ] `pnpm check:examples` passes for all example workspaces.
- [ ] Repository `forma check` and `forma workspace health` report zero diagnostics.
- [ ] Documentation describes each surface's real capability and never presents a list as an interactive timeline.
- [ ] Affected built-in help and skill projections are verified.

## Compatibility And Migration

No migration is required: this is purely additive. There is no schema change, no configuration rewrite, and no change to any existing View mode.

Core and shared must ship in the same release, because the union gains a member that older consumers cannot interpret. Every current consumer gains explicit dispatch in slice 4, and an unrecognized projection must produce an explicit unsupported message rather than a Table fallback. No general protocol negotiation is introduced.

Calendar is unaffected. Its wire types, ordering, diagnostics, and tests must remain byte-identical throughout, and slice 1 exists specifically so that this is provable rather than asserted.

`relation` accepts only `finishToStart` and rejects anything else, so adding relation types later is additive. The contract adds no range, zoom, or window configuration keys, so the visible window stays viewer state and does not become a public contract.

Row height is fixed because titles are single-line. An implementation that later allows titles to wrap invalidates the hand-written windowing and must revisit the virtualization decision rather than work around it.

## Verification Gates

Per slice, run the affected crate or package checks named in its acceptance criteria. Reuse passing evidence until a change, a failure, or an unresolved risk justifies rerunning.

Before the final slice is considered complete: `mise run check`, `pnpm check:examples`, repository `forma check --json` and `forma workspace health --json` with zero diagnostics, two byte-identical static builds, and WebApp visual validation through the real backend. Local success is not release or installed-host acceptance.

## Implementation Record — 2026-09-22

The implementation covers all eight slices and was committed as `217fa2e`, without adding runtime dependencies. The user subsequently authorized governance reconciliation on 2026-09-22: the related tasks move to reviewing, while responsibility assignment and final acceptance remain open. The checklist above remains the detailed acceptance inventory; the following evidence does not claim that every individual case has a dedicated automated assertion.

- Core now shares temporal normalization with Calendar and emits Gantt nodes, scheduled rows, deterministic dependency edges, aggregate reference counts, and strongly connected component diagnostics. Existing Calendar integration tests remain unchanged and the getting-started Calendar JSON was byte-identical before and after extraction.
- Shared wire types, live and static WebApp clients, static HTML, and the VS Code preview explicitly support Gantt. A repository fixture is checked against actual Core output, not just hand-written TypeScript data. Static HTML and VS Code provide complete semantic lists rather than claiming timeline capability.
- The WebApp provides a dependency-free, fixed-row-height timeline with one native scroller, two-axis windowing, sticky titles and date headers, native date jumps, day-width controls, keyboard navigation, selected-row connectors, classification accents, and an expandable complete node list. A conservative 1,000,000 px materialized-size budget includes title width and vertical extent; actual dimensions are checked for browser clamping.
- Runtime testing exposed scroll clamping after distant date jumps and after reducing day width. Reserving sufficient trailing space now preserves the requested leading date. Regression assertions cover both paths. Header labels include the visible month/year range across boundaries.
- Product docs and the getting-started example describe explicit bindings, dependency semantics, and each surface's actual capability. No inferred Task metadata, date write-back, conflict evaluation, or scheduling engine was introduced.

### Verification Evidence

- `mise run check` passed across the repository. The later focused changes were covered by the affected checks and builds.
- Eight Core Gantt integration tests passed, including nested-field isolation, scalar references, malformed reference-list items, duplicate/self/outside-selection counts, cycles through unscheduled and invalid entries, binding diagnostic caps, temporal boundaries, DST, and the real shared wire fixture. All ten existing Calendar integration tests passed unmodified.
- Shared helpers, both WebApp client dispatch paths, layout arithmetic, VS Code preview, and static HTML have focused test coverage. The shared/client/layout/preview run passed 31 tests; the static Gantt renderer test passed.
- All example workspace checks passed. Repository `forma check --json` and `forma workspace health --json` each reported zero errors, warnings, and infos. Updated `workspace.views` and `cli.view` built-in documentation projections were verified.
- Two static builds of the getting-started workspace were byte-identical: 37 routes, 39 pages, and eight Views, with no diagnostics.
- Headless Playwright Chromium, Firefox, and WebKit checks used the real Forma server and production WebApp build over 5,000 synthetic candidates (4,849 scheduled and 151 unscheduled). Both themes at 1440, 1024, 768, and 390 px had zero root overflow and no nested timeline scroll owners; 22 data rows plus the header were mounted. Jump/zoom anchor preservation, left extension, sticky title positioning, bar geometry, representative keyboard navigation including first/last rows, the complete 5,000-node list, and the 1,000,000 px budget on both axes passed without captured page errors. Desktop and mobile screenshots were inspected.

### Presentation And Commit-Preparation Review — 2026-09-22

The follow-up review retained the implemented scope and added no runtime dependencies. It corrected Today draft restoration, same-range jump compensation, vertical-scroll range extension, empty-state controls, selected-title styling, and low-zoom date ticks. Month/year headings now occupy a separate band; feature-local DOM positioning centers labels in each month's visible intersection without React-driven per-scroll coordinates. Duplicate style writes are skipped. Both scrollbar controls are hidden while the single native scroll owner and keyboard navigation remain intact.

- Seventeen focused WebApp layout/component/DOM-position tests passed. These include explicit geometry stubs and do not claim browser layout or frame-timing coverage.
- `mise run check` passed after the final scrollbar implementation. No source changes followed during commit preparation; subsequent changes only synchronize documentation and evidence.
- Playwright CLI rechecked Chromium 154.0.8037.0, Firefox 156.0, and WebKit 26.6 against the production server at 1440 and 390 px under light/dark media preferences. All twelve combinations retained hidden scrollbars with zero gutter, native wheel movement on both axes, focused Home/End row navigation, and no captured page errors. This targeted follow-up supplements, rather than repeats, the earlier full behavior matrix.
- IAB checks covered refresh, left-edge extension, visible-month centering, date jumps, zoom, and responsive layout. Small transient title jitter remains an accepted presentation limitation, not a claim of frame-perfect synchronization.
- The selected-row SVG paths remain the initial connector capability, not an all-edge or arrow-routing implementation. Bar labels, progress fills, and enhanced connectors are deferred; this preparation stage adds none of them.
- Source, tests, examples, and shared English documentation form the proposed commit scope. Synthetic workspaces, screenshots, browser scripts/state, local reports, generated builds, and caches are excluded. No Task lifecycle, ownership, proposal status, commit, or publication change is implied.

### Remaining Validation Boundaries

This is local implementation evidence, not release acceptance. Real screen-reader announcements, installed Safari/mobile browser behavior, and an installed VS Code host remain unverified. Keyboard checks cover representative navigation and both extremes, not exhaustive traversal of every row. The earlier spike's latency numbers are not production performance claims; a production median/p95 benchmark has not been established. Browser scripts, screenshots, and synthetic workspace data remain local-only.

## Follow-On Delivery — 2026-09-22

Bar titles, progress fills, and directed connector routing were added after the initial eight slices, under a contract amendment for the progress binding. Progress is a scalar `integer` percent on the node; connectors gained arrowheads, off-window endpoint drawing, and a route-around for successors that start before their predecessor ends. Details and verification are in [[tasks/validate-lightweight-gantt-view]]; behavioural rules are in [[proposals/gantt-temporal-view-contract]].

## Out Of Scope

Write-back and drag-to-reschedule, automatic scheduling, resource load, critical paths, working-day and holiday engines, progress percentages, relation types beyond finish-to-start, lag, time resolutions other than days, all-edge connector rendering, dependency-aware row ordering, and any new runtime dependency.

Dependency-aware row ordering is deliberately deferred. Existing field-based sorting does not implement graph ordering; any future extension requires a separate semantics review.

## Remaining Governance Decisions

The Gantt design proposal was explicitly accepted by the user on 2026-09-22. Related tasks remain reviewing; the following delivery and assignment decisions are not implied by design acceptance.

1. Independent review is recorded in [[proposals/gantt-temporal-view-contract]]. The corrected contract and Core/consumer regressions are committed as `217fa2e`; product acceptance remains a separate decision. The prototype alone is not production acceptance.
2. Owner and reviewer assignment, and whether implementation runs under [[tasks/validate-lightweight-gantt-view]] or a new implementation Task. Both need explicit authorization.
3. Nothing in this repository's own Tasks gains date fields as part of this work.
