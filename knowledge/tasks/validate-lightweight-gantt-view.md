---
schemaVersion: 1
kind: task
scope: project
title: Validate Lightweight Gantt View
summary: Validate read-only timeline bars, explicit dependencies, and a bounded implementation plan using representative data.
type: task
priority: P2
value: H
module: views
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers:
    - "members/tiscs"
tags:
    - views
    - gantt
    - validation
blockedBy: []
relatedTo:
    - tasks/define-temporal-view-contract
    - tasks/implement-read-only-calendar-view
sources:
    - architecture/forma-view-query-model
    - guidelines/dependency-governance
---

# Validate Lightweight Gantt View

## Goal

Validate whether read-only Gantt support without new specialized libraries can meet real interval and dependency-reading needs. Produce a reviewable implementation scope and a go/no-go conclusion. This task delivers validation evidence and a plan, not a commitment to ship complete Gantt support.

## Sources

- [[tasks/define-temporal-view-contract]]
- [[tasks/implement-read-only-calendar-view]]
- [[architecture/forma-view-query-model]]
- [[guidelines/webapp-engineering-and-visual-validation]]
- [[guidelines/dependency-governance]]

## Planning Review — 2026-09-20

The lightweight technical direction passed assessment for validation; product fit remains unconfirmed. Repository Tasks lack start/end fields, and duration must not be inferred from effort, status, or a single dueDate. The temporal contract shared with Calendar is a hard dependency. Calendar delivery experience can be reused, but shipping the complete Calendar must not be treated as a hard blocker for read-only Gantt research.

## In Scope

- Build neutral project fixtures with explicitly configured start/end fields. Use authorized, sanitized representative real plans where available. Otherwise label data as synthetic and do not treat synthetic results as demand validation.
- Validate date bars, same-day/cross-month intervals, missing dates, and milestone representation using Core temporal semantics. Bind start/end and dependency fields explicitly.
- Validate HTML/CSS bars, title columns, date ticks, local horizontal scrolling, and a narrow-screen list fallback. Begin with a minimal isolated prototype and measure host scrolling behavior; do not introduce a scroll-synchronization framework or Canvas by default.
- Resolve dependencies from explicitly configured entryRef/referenceList fields. Define edge direction and the initial relationship type, detect self-dependencies, cycles, unresolved targets, and filtered-out targets, and do not automatically schedule from these relationships.
- Compare navigable dependency lists with small inline SVG connectors. Lists provide baseline accessibility. Without connectors, report only timeline-bar/dependency-list capabilities rather than claiming validation of graphical dependency reading.
- Reuse existing Rust date libraries and native browser capabilities with zero new specialized libraries. Do not add d3 for date-to-coordinate mapping or introduce a generic timeline package in advance.
- Measure node counts, computation, scrolling, and initial-render costs for small/1000/5000-entry datasets and long time spans. Clip ranges by date column, avoid creating a full year of daily DOM nodes for every entry, and consider row windowing only when evidence requires it.
- Propose a capability matrix for WebApp, VS Code, and static output, cross-surface reuse boundaries, implementation slices, and required verification.

## Out of Scope

- Changing real task schedules, drag-and-drop write-back, automatic scheduling, resource load, critical paths, and working-day/holiday engines.
- Providing progress percentages, complex grouping, every dependency relationship type, or pixel-identical behavior across hosts by default.
- Installing candidate libraries, publishing the prototype, or integrating it directly into a production View mode.

## Acceptance Criteria

- [x] Reference the reviewed temporal contract and assign an owner/reviewer. Make sample provenance, synthetic/real-data boundaries, and field coverage verifiable.
- [x] Demonstrate stable bar positioning across DST, month boundaries, and different workspace timezones without inventing unknown dates.
- [x] Provide examples of dependency-edge semantics and exceptional-case diagnostics, explaining the benefits and complexity of graphical connectors relative to lists and the initial choice.
- [x] Record actual evidence for long titles, overlapping spans, narrow screens, keyboard navigation, light/dark themes, and host-local scrolling.
- [x] Record performance samples, output/DOM size, bottlenecks, and whether windowing is necessary. Do not promise performance against unmeasured thresholds.
- [x] Produce an evidence-backed go/no-go conclusion. If successful, provide a Gantt implementation plan with acceptance criteria; otherwise document missing data/value evidence or complexity limits. Subsequent implementation task creation and publication remain subject to the authorization in effect at that time.
- [x] Add no runtime dependencies and make no unreviewed changes to production modes or public DSL.

## Readiness

Validation, design review, and the subsequently authorized production implementation are committed in `217fa2e`, following Calendar's `afc3bc7`. The proposal is accepted by explicit user approval on 2026-09-22. `members/tiscs` is owner, assignee, and reviewer. Readiness is `ready`; status is `done` following user acceptance on 2026-09-24. Real Safari, physical-device, and screen-reader behavior remains unverified; the user accepted deferring these checks for 0.1.37, so they are documented limitations rather than release blockers.

## Acceptance Reconciliation — 2026-09-24

The validation task's layout, dependency semantics, scale, zero-new-dependency evidence, and go recommendation are recorded in [[design/gantt-view-validation-2026-09-22]]. The resulting implementation plan and production verification are in [[planning/gantt-view-implementation-plan]]. These deliverables exist; unchecked composite criteria are not a claim that execution has not started. The dedicated temporal-binding diagnostic aggregation regressions identified by the external review are now covered by tests. Enhanced connectors, bar labels, and progress fills are implemented in the working tree, with their review and corrections recorded below; they are no longer deferred enhancements. Owner, assignee, and reviewer are `members/tiscs`; final acceptance was confirmed on 2026-09-24; assistive-technology validation remains explicitly deferred. Current packaged-host evidence is recorded in Closeout Reconciliation below and [[planning/temporal-view-release-plan]]. On 2026-09-24 the user chose to draw every anchored connector at every row count and retain the current high-density appearance for now; future optimization is deferred. These updates do not change Task lifecycle metadata or imply release completion.

## Independent Review Closure — 2026-09-22

The independent follow-up review corrected the remaining inconsistencies in [[proposals/gantt-temporal-view-contract]] and [[planning/gantt-view-implementation-plan]] and reran the strengthened local conformance checks. The complete projection example, both endpoint states, dependency accounting, cyclic components through unscheduled/invalid nodes, and negative controls pass; evidence boundaries are recorded in [[design/gantt-view-validation-2026-09-22]]. The Core temporal boundary and browser-size fallback now have explicit implementation acceptance criteria.

At this 2026-09-22 handoff review, no unresolved design blocker remained, but this was not production delivery acceptance: Gantt implementation, production Core/consumer tests, cross-browser layout checks, and installed-host/accessibility validation were still required. Owner/reviewer assignment and implementation dispatch remained for the user at that stage. Existing lifecycle and assignment metadata was unchanged; no commit or external handoff was performed.

## Closeout Reconciliation — 2026-09-24

The user confirmed ownership and final acceptance responsibility. `members/tiscs` is the owner, assignee, and reviewer. The Task is `done` with `ready` readiness; final user acceptance was confirmed on 2026-09-24.

The current full gate passed 494 TypeScript tests and 11 Calendar plus 10 Gantt Core integration tests. Current fixture and consumer coverage is recorded in [[tasks/cover-temporal-view-contract-in-committed-fixtures]]. These local checks establish code and projection behavior; browser, host, and release evidence is recorded separately below.

Physical-device and installed Safari behavior and real screen-reader behavior remain unverified; the user accepted their deferral for 0.1.37, so they are documented limitations rather than release blockers. The user accepted the current high-density connector appearance on 2026-09-24 and deferred visual optimization. Fixture follow-up is now `done`; its source workspace is `fixtures/temporal-views/`, while manual cases remain in `fixtures/forma-validation/`.

### Current Browser And Host Coverage — 2026-09-24

Playwright exercised the production WebApp in Chromium 154, Firefox 156, and WebKit 26.6 using a 5,000-candidate Gantt projection (4,849 scheduled, 151 unscheduled, and all 1,839 anchored edges). At 1440px and 390px in light and dark themes, scrolling, keyboard navigation, and access to the complete list passed. Calendar checks passed for the native month/date control and its date-input fallback, date drawer, and Agenda.

Trusted source-host tests using VS Code's built-in `markdown.api.render` passed at minimum supported VS Code 1.123.2 and stable 1.139.0. A separate restricted-mode test passed for workspace-trust behavior; temporal rendering was asserted in trusted workspaces. The installed packaged-VSIX smoke passed 3/3 at minimum supported 1.123.2, including built-in Calendar/Gantt HTML, source-link, and progress assertions. Artifact SHA-256: `5ef5f9820b75ed86de322aeb91f662d432e44e1ec71b98d38e6abc9271ddc84f`; size: 219,617 bytes. The initial package test exposed two async defects: fresh scheduler callers could join cancelled work, and an obsolete NativePreview refresh could overwrite newer state through an ABA generation match. The scheduler now replaces cancelled work; NativePreview completion checks controller identity. Both fixes passed deterministic red-green tests. Detailed gate evidence remains in [[planning/temporal-view-release-plan]]. Real Safari, physical-device, and screen-reader validation remains unverified, with 0.1.37 deferral accepted; publication and final Task acceptance remain separate. The earlier extension-package evidence below describes a previous package and is historical only.

### Cross-browser And VS Code Extension Checks — 2026-09-24

Playwright CLI 0.1.21 exercised the production WebApp build against a synthetic exhibition workspace in Playwright-managed Chromium, Firefox, WebKit, and installed Microsoft Edge. The branded Google Chrome app was not installed, so its channel was not tested. At 1440, 1024, 768, and 390 CSS-pixel widths, the page had no horizontal root overflow; the Gantt retained its internal scroll area, 17 progress fills, 14 connector paths, and one milestone. Arrow/Enter row selection and locating, horizontal wheel scrolling, and the native theme popover's System-to-Light-to-Dark transitions passed in all four desktop sessions. iPhone 17/WebKit and Pixel 10/Chromium emulation also had no root overflow, and a touch tap selected a different row. The iPhone preset reported zero `navigator.maxTouchPoints` despite its coarse-pointer mode, so these are browser-engine and device-emulation results, not tests on physical devices or installed Safari.

There were no browser JavaScript errors. WebKit logged one non-fatal warning that a preloaded route JavaScript asset was unused within a few seconds after load. The synthetic Core projection intentionally reports one `view.ganttIntervalInvalid` diagnostic; the page still renders 17 scheduled, one unscheduled, and one invalid item. The warning and synthetic invalid entry are not counted as browser failures.

Historical extension build evidence: VS Code extension verification passed 26 Vitest files (187 tests), 19 Node script tests, TypeScript/icon checks, ESLint, and the production build. A 57-file, 214.09 KB VSIX from that earlier state was packaged and passed archive integrity validation. This is an earlier artifact; current installed-package evidence is recorded above.

### Earlier VS Code Host Integration Snapshot — 2026-09-24

With explicit approval to open test windows and take focus, `mise exec -- pnpm test:integration` passed against minimum supported VS Code 1.123.2 and stable 1.139.0 on macOS arm64: activation/workspace behavior and command/wiki-link/view-source behavior passed in each version (2 tests each). The restricted-mode untrusted-workspace test also passed (1 test). Total: 5 passing host tests. The temporary editor sessions used isolated test profiles. VS Code emitted non-fatal environment/deprecation warnings, including an overlong temporary IPC socket path; the command exited successfully. This earlier smoke suite predates the current Markdown enhancement packaging gate and is not an unconditional installed-host release pass.

## Development Preparation — 2026-09-21

Historical stage notes below are preserved as evidence. Current lifecycle and acceptance boundaries are in Readiness, Acceptance Reconciliation, and Closeout Reconciliation above; subsequent production evidence is in Implementation Review below. Statements about absent implementation or commit authority describe their original stage, not the current state.

The user requested development preparation after the Calendar implementation commits. This section records a proposed validation sequence, not approval of a new public DSL or production implementation. No library installation, prototype execution, production code change, task-state change, commit, or publication is part of this preparation.

### Verified Starting Point

- Baseline: `afc3bc7`, following dependency maintenance `28dee3f`; the working tree was clean when preparation began.
- [[proposals/calendar-temporal-view-contract]] owns accepted date/instant semantics. [[design/calendar-view-validation-2026-09-21]] records Calendar evidence and remaining host/review limitations. Calendar performance numbers are not Gantt benchmarks.
- `crates/forma-core/src/render/calendar.rs` currently owns schema binding, normalization, covered civil dates, diagnostics, and Calendar projection assembly. Its private normalization code depends on Calendar definitions and emits Calendar-specific errors; it is not yet a reusable temporal interface.
- `RenderCandidate.references` and `render_field_value` in `crates/forma-core/src/render.rs` consume indexed frontmatter references. Reuse the existing resolver and field identity instead of resolving dependency strings in each host. The schema supports `entryRef`, named reference types, and lists of these; `referenceList` is a render-value variant, not a schema type to invent in configuration.
- `packages/shared/src/calendar.ts` contains Calendar wire types and range labels. `calendar-layout.ts` is feature-local civil-date layout, not a general scheduling engine. Graph classification/color rules can be reused after actual Gantt requirements are established.

### Proposed First Capability

Deliver a read-only, day-resolution timeline for explicitly configured intervals. A row represents one source entry; source/query selection and configured sort remain authoritative. Use a sticky title column and time header inside one local scrolling region so row alignment does not require synchronized scroll containers. Render one bar per row and shared date ticks/background rules, not a cell for every row/day pair. Narrow screens use a complete navigable list.

Use neutral exhibition-preparation fixtures with `startsOn`, `endsOn`, and `predecessors`, including nonstandard configuration paths. These names are examples, never built-in Task fields. Do not populate repository task dates. Proposed bindings follow `fields.<path>`; exact `gantt` configuration keys and serialized projection require a separate contract review before integration.

Start with Calendar-compatible semantics: authored date ends inclusive, datetime ends exclusive, missing date end one day, missing/equal datetime end a point, no start unscheduled unless an orphan end makes it invalid. Preserve exact instants in labels while using Core-projected civil spans for day-resolution bars. DST must not alter column width. A point marker is not automatically a business milestone; do not infer milestones from missing ends or same-day dates. Explicit milestone metadata and rendering remain a decision for the validation contract.

Proposed interactive range controls are previous/next, Today, and a native month/date jump consistent with Calendar. Start with a bounded visible month; validate a wider overview before adding zoom levels. Clip bars at the visible edges with clear continuation cues, retaining full range labels. Keep out-of-range rows discoverable and distinguish them from unscheduled/invalid entries. No per-visible-range RPC contract or silent data truncation is introduced by this proposal.

### Proposed Dependency Semantics

- The configured field on B lists its predecessors A. The directed edge is A → B, initially finish-to-start only, with no lag, calendar constraints, or scheduling writes. A missing optional dependency field means no declared dependencies.
- Validate the bound schema as a reference or list of references, including named reference types. Match resolved references by exact configured field; body links and unrelated references must not become dependencies.
- Preserve source-locatable unresolved-reference diagnostics. Distinguish an unresolved target from a resolved target excluded by source/query or unavailable to the output surface. Do not reintroduce excluded entries into the projection or leak their content through labels/links.
- Deduplicate edges deterministically. Diagnose self-edges and cycles without discarding valid temporal rows or changing their sort order. Cycle conclusions apply to the selected dependency graph only; do not claim a workspace-wide acyclicity check when filtered targets are absent.
- A target without a usable interval remains a dependency-list entry when available, but cannot anchor a timeline connector. Distinguish temporal-invalid, unscheduled, and outside-visible-range targets.
- At this preparation stage, navigable predecessor lists were the accessible baseline and selected-row SVG connectors were proposed for comparison. The 2026-09-24 decision superseded this visibility scope: all anchored edges are now rendered. Complex routing remains deferred.

### Implementation Seams After Approval

1. Define a small Core-internal temporal module only when Gantt becomes its second real consumer. It should accept the loaded model/configuration and explicit bindings, return normalized temporal values plus structured failures, and perform no independent workspace loading. Calendar and Gantt adapters own their projection assembly and diagnostic namespaces. Preserve Calendar wire types, ordering, diagnostics, and all existing tests; avoid a public generic timeline framework.
2. Keep dependency resolution/validation in Core, consuming indexed references. Proposed Gantt output contains row identity, normalized temporal data, classification where configured, counts, and dependency statuses/edges; it does not contain pixel coordinates, per-day row copies, or arbitrary frontmatter.
3. Keep row/bar/tick geometry feature-local in WebApp. Use HTML/CSS for bars and existing native/DaisyUI controls; evaluate minimal SVG only for connectors. Reuse existing chrono/chrono-tz and Intl. Add no Calendar/Gantt, d3, timezone, or virtualization dependency.
4. Add a separate typed Gantt projection and explicit dispatch across current consumers only after contract approval. Reuse range-label logic only where semantics actually agree, preserving Calendar exports. Static HTML and VS Code initially render deterministic full interval/dependency lists rather than promising interactive timeline parity. Static output must not depend on the build date, and unavailable targets must not produce broken links.

### Bounded Execution Sequence

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| A — contract and fixtures | Proposed bindings, temporal/milestone/dependency rules, diagnostic cases, cross-surface matrix, seeded synthetic fixture manifest | Decisions reviewed; provenance and expected results explicit; no production mode registered |
| B — isolated layout validation | One-scroll-owner timeline, title links, clipped bars, keyboard list fallback, dependency-list versus selected-row SVG comparison | Long titles, DST/cross-month spans, zoom/browser resizing, light/dark, and narrow-screen behavior verified |
| C — correctness and scale | Temporal/reference oracle results and measured 30/1000/5000-row sparse/dense/long-span datasets | Actual bottlenecks recorded; explicit go/no-go and any windowing/range proposal; no guessed performance claim |
| D — production implementation proposal | Final DSL/projection, file-level work slices, migration/compatibility notes, acceptance criteria | User approval before production integration or creating implementation Tasks |

Stage B may use fixture data with explicit expected spans, but must not introduce a second production temporal evaluator. Shared temporal extraction belongs to the approved integration slice, not to preparation or a visual prototype.

### Verification Plan

- Correctness: leap dates, four-digit year bounds, DST 23/25-hour days, browser/workspace timezone mismatch, inclusive/exclusive endpoints, points versus milestones, missing/invalid/reversed dates, typed/named reference fields, duplicate/self/cyclic/unresolved/filtered dependencies, and selection/sort determinism. Retain Calendar regression coverage when extracting shared internals.
- Rendering: 1440/1024/768/390 px, light/dark, long titles, multi-year spans, many rows, empty/unscheduled/all-invalid sources, local scrolling, range continuation, keyboard focus, source navigation, and clean browser logs. Use playwright-cli across Chromium, Firefox, and WebKit; report installed Safari/mobile and real screen-reader gaps separately. Installed VS Code host results are recorded below.
- Performance: record seed, row/edge counts and density, span distribution, machine, build, DOM/output size, and at least 20 latency samples with median/p95. Separate Core cold/warm work, initial rendering, range switching, and scrolling. Compare a small baseline before setting budgets; Calendar's prior 5000-entry timings do not establish Gantt thresholds. If row windowing is necessary, propose a bounded implementation without silently omitting accessible content.
- Integration gates, if approved later: affected Core/shared/consumer tests, production WebApp build and real-backend checks, static no-script output/navigation, workspace/example checks, and `mise run check`. Prototype measurements are not release or installed-host acceptance.

### Decision Before Execution

Recommend approving stages A–C as a bounded validation effort with zero new dependencies and synthetic fixtures unless an authorized representative plan is supplied. This is a **go for contract/prototype validation**, not a go for production Gantt. Confirm the day-resolution scope, explicit milestone policy, initial finish-to-start dependency convention, connector experiment, and review responsibility before claiming execution readiness. A failed connector experiment may support a timeline-with-dependency-lists proposal, but must be reported as reduced capability rather than quietly treated as full graphical Gantt support.

## Stage A Execution — 2026-09-22

The user approved the bounded validation stages A–C and asked that the preparation record stay uncommitted for now. Stage A produced [[proposals/gantt-temporal-view-contract]], which holds the proposed bindings, interval and milestone rules, four-state dependency semantics, diagnostic codes, cross-surface capability matrix, seeded fixture manifest, verification oracles, and performance plan. That document is `status: proposed`; authoring it does not satisfy Stage A's review exit condition, and it does not approve a production Gantt implementation or change this Task's lifecycle metadata.

Source inspection corrected one assumption carried in the preparation section above. Unresolved frontmatter references never become index references: `resolve_frontmatter_ref_value` in `crates/forma-core/src/index.rs` records `entryRef.unresolved`, the ambiguous variant, or `entryRef.transformFailed` and returns without appending to `refs`, which `unresolved_and_ambiguous_refs_are_diagnostics_not_index_refs` asserts. A Gantt adapter therefore cannot identify a specific unresolved target from resolved references, and must derive a declared-versus-resolved count from the bound raw frontmatter value. The contract adopts that approach and keeps the existing index diagnostics as the locatable source rather than restating them.

Two further boundaries were verified and carried into the contract. `collect_semantic_reference_fields` builds dotted frontmatter paths and flattens list schemas onto the same path, so a `fields.<path>` dependency binding maps directly onto `IndexReference.field` for scalar references, reference lists, named reference types, and nested paths. Graph edge construction silently skips references whose target is outside the selected set, which Gantt must not copy unmodified because this Task requires separating an excluded target from an unresolvable one.

Repository `forma check` passed with zero diagnostics after the write. No production code, configuration, dependency, Task metadata, or commit was changed in this stage.

## Stage B And C Execution — 2026-09-22

Stages B and C ran under the same approval. Evidence is in [[design/gantt-view-validation-2026-09-22]] and the corrections are folded into [[proposals/gantt-temporal-view-contract]]. No production View mode was registered, no dependency was added, no production source file was changed, and nothing was committed.

The fixture is a real Forma workspace rather than prototype-only data. Because the contract reuses Calendar's temporal normalization and the existing indexed-reference resolver verbatim, both halves were exercised through the existing `calendar` and `graph` View modes, yielding genuine Core results without a Gantt mode. Scale fixtures are seeded with `20260922`.

Every temporal expectation held, including 23 and 25 hour DST days occupying exactly one column, an instant crossing a local date boundary, an end at local midnight excluding that date, and rejection of a date-shaped string under a string schema. Two facts corrected the contract: workspace schema validation already rejects non-boolean milestones, empty date strings, and offset-free datetimes before any View runs, while a well-formed but nonexistent date such as `2027-02-29` is not caught there; and one wrong binding emits one diagnostic per candidate, measured as 33 identical warnings over 33 entries, which at Gantt scale requires collapsing binding-type failures into one View-level diagnostic with a count.

The dependency model gained two states. Counting resolved targets from deduplicated edges misreported a duplicate declaration as unresolved, so resolved targets must be counted from index references, which retain duplicates. The four-state model also failed an arithmetic invariant: a duplicate and a dropped self reference each vanished from the counts. Explicit `duplicates` and `selfReferences` counts close `declared = predecessors + outsideSelection + unresolved + duplicates + selfReferences`, now verified for every row in both projections. A filtered View provided the decisive evidence for the counting requirement: a step declaring two predecessors in an excluded stage showed zero dependencies, indistinguishable from a step that declares none.

Layout validation confirmed the architectural bet. The timeline holds zero nested scroll containers, and both sticky axes held at a 1 px offset under simultaneous horizontal and vertical scrolling. Day-header nodes stayed at exactly 31 from 29 rows to 4849 rows, with total DOM at roughly 9.4 nodes per row. Bar geometry matched the oracle exactly, the 390 px fallback listed 22 of 22 rows and all 7 unscheduled entries, no root horizontal overflow appeared at any tested width or theme, real Tab traversal matched `:focus-visible`, and the console stayed empty. Three layout defects were found by measurement and corrected: an out-of-range notice that scrolled out of view, the same notice then sitting underneath the sticky title column while passing every bounding-box check, and a selected row naming two predecessors while drawing one connector with nothing to explain the difference.

Scale measurement used a release build and 20 samples per cell. Core cost is linear and 58 to 63 percent workspace loading. Edge density barely affected Core time but tripled serialized output. In the browser, the 4849-row month switch measured a 306 ms median, and a targeted experiment isolated the cause as rebuilding row titles and badges that a range change cannot affect: restricting the update to range-dependent content reduced it to a 1 ms median with a 48 ms worst case. Row windowing is therefore not required at 5000 rows.

The conclusion is **go for the contract and the layout approach**. Acceptance criteria remain unchecked and ownership unassigned, because validation evidence is not review and this record does not change Task lifecycle metadata. Stage D remains subject to the authorization in effect at that time.

## Scope Change — Continuous Scrolling — 2026-09-22

The user replaced the bounded visible month with a continuously scrolling horizontal timeline and permitted a virtualization dependency if performance required one. This supersedes the "bounded visible month" and edge-clipping elements of the Development Preparation section above. The prototype was rebuilt and re-measured; evidence is in [[design/gantt-view-validation-2026-09-22]] and the contract is updated.

The change simplifies more than it complicates. Bar clipping, continuation cues, the out-of-range row state, and the visible-range dependency state all disappear, because every bar sits at a real position on one uninterrupted track. Three of the layout defects found under month paging were consequences of paging and no longer exist in that form, and the measured 306 ms month switch disappears with the month switch itself.

Steady-state scrolling needs no optimization: 4832 rows over a 48,260 px track measured a 5.8 ms median horizontal scroll step and a 177 ms initial render. Cost concentrates entirely in extending the range. Extending by 180 days at that size measured 142 ms with a naive re-render and 101 ms with a fixed-epoch variable update, because changing the total column count re-lays out every row track. Extending to 34 years with rows windowed but day labels not windowed degraded monotonically from 9 ms to 58 ms. Windowing rows and day labels together held it at a 3 ms median and 471 DOM nodes, flat across 60 extensions.

Windowing is therefore required on both axes, and it carries an accessibility obligation that the contract now states: at 971 rows only 36 were in the document, no full row count was published, and the complete list was hidden above 767 px. Row windowing also reintroduces the unanchored-connector case, because a predecessor outside the rendered window has no element to anchor to.

The dependency question stays open and is the one decision that needs an answer. Roughly fifty lines of hand-written two-axis windowing produced the flat 3 ms result with no dependency, so the measurements do not require a virtualizer. The deciding factor is whether row heights stay fixed: if long titles are allowed to wrap, hand-written windowing needs dynamic measurement and `@tanstack/react-virtual` becomes the better choice. `@tanstack/react-virtual` was not installed or benchmarked. Dependency governance classes a virtualizer in the timeline as architecture-shaping, and this Task's own acceptance criteria currently forbid adding a runtime dependency, so adopting one requires amending that criterion first. No dependency, manifest, or lockfile was changed.

## Windowing Decision — 2026-09-22

The user chose single-line truncated row titles, hand-written windowing, and no virtualization dependency. This resolves the only decision Stage C had left open and keeps this Task's acceptance criterion forbidding new runtime dependencies intact. `@tanstack/react-virtual` was evaluated as the alternative that the measurements did not require; it was never installed or benchmarked, and no manifest or lockfile was touched. Fixed row height is now a contract constraint rather than an implementation convenience: an implementation that lets titles wrap must revisit this decision rather than work around it.

The decision made it worth closing the remaining gap. Accessible windowing had been specified in the contract but not built, so the prototype demonstrated the problem rather than the remedy. It has now been built and verified, and evidence is in [[design/gantt-view-validation-2026-09-22]].

Accessibility semantics were checked by reading the accessibility tree rather than inspecting attributes, because `display: contents` on the row wrapper was a real risk to the roles. The tree exposes a grid with column headers, and each data row as a rowheader holding the title link plus a gridcell whose accessible name carries the title and date range; since the bar is purely visual, that name is how the interval reaches a screen reader. Keyboard traversal reached 971 of 971 rows and 692 probes across 4832 rows with no lost focus, no wrong target, and every target scrolled into view.

Three regressions surfaced while building it, all the same shape. Focus dropped to the document body during ordinary arrow-key traversal, because re-rendering replaces the row elements and a re-render can come from scrolling, a window shift, or a range extension; restoration had to move into the render path rather than the navigation helper. The navigation helper re-rendered on every keypress even when the window had not moved. Every render rebuilt the entire complete list, which does not depend on the range, costing 21 ms per keypress at 971 rows until decoupled to 4.5 ms. That last one is the third measured violation of the same rule, after row titles under month paging and row tracks under naive extension, so the contract now states it as a standing implementation constraint.

At 4832 rows the timeline stays flat at 432 nodes while the always-present complete list adds 14,499, roughly three per row. That raises range extension from 3 ms to 12 ms and keyboard traversal to 15.9 ms per keypress, both still inside a frame budget, and is the accepted price of reachability. Invariants held: one scroll owner, no root overflow, correct `aria-rowcount`, 4.4 ms median horizontal scroll.

Not verified: a real screen reader. Announcement of a shifting row window is the most likely place this falls short. Browser find-in-page still reaches only the rendered window plus the complete list, which is inherent to windowing.

## Scroll Axis Lock — Built And Withdrawn — 2026-09-22

The user asked for an axis-locking scroll so that scrolling one axis raises the threshold for the other. It was implemented in the prototype, measured, and then **withdrawn after the user tested it on real hardware and found the diagonal drift still present.** The code is removed from the prototype and the requirement from [[proposals/gantt-temporal-view-contract]]; the native two-dimensional interaction is retained by the user's decision.

The earlier measurement was wrong, and the reason matters. Every synthetic gesture used `cancelable: true` wheel events. Chromium on macOS delivers **non-cancelable** wheel events during the momentum phase of a trackpad gesture, where `preventDefault` is a no-op. Replaying the same gesture with `cancelable: false` reproduced the failure exactly: twenty events, zero prevented, 120 px of vertical drift applied by the browser, while the handler's own counter still claimed it had suppressed 120 px. So the lock holds only while the finger is on the trackpad, and the browser resumes two-axis scrolling through the inertia tail, which carries most of the distance.

The threshold was ruled out before concluding: the lock engaged on every event up to cross-axis noise of 60 percent of the major axis and only began falling through at 80 percent, so tuning would not have helped.

The drift itself is real and was quantified before the approach was rejected. A replayed horizontal gesture with the one-directional noise a real hand produces carried 81 px of unintended vertical movement over a 612 px swipe, about two and a half rows at a 34 px row height. Making that go away reliably would require taking native scrolling off one axis and driving it from script, which costs momentum, rubber-band overscroll, scrollbar dragging, and the single-scroll-owner invariant the layout depends on. Keeping the native interaction is the better trade.

The method lesson is recorded deliberately: synthetic wheel events were clean enough to make a broken approach look like it worked, and only real-device testing caught it. Prototype-level browser measurements of input behaviour should be treated as provisional until exercised on real hardware.

## Connector Feasibility Spike — 2026-09-22

The user asked whether deferring connectors risks the architecture being unable to support them later. That was tested directly rather than reasoned about, and the answer is no. Evidence is in [[design/gantt-view-validation-2026-09-22]].

Three things could have blocked it, and none does. Row windowing does not, because connector geometry is computed from row index and date offset arithmetic rather than from element rectangles: an edge spanning 942 rows was drawn with only 36 rows in the document, and scrolling to each endpoint afterwards showed the predicted position matching the real bar exactly on the horizontal axis and within 1 px vertically, at a scroll depth of 32,428 px. Scale does not, because 1,882 paths over 4,832 rows drew once in 16 ms and then cost nothing to scroll. Overlay size does not, because a 48,260 by 164,332 px SVG rendered without trouble; a full overlay also beats a viewport-windowed one, which trades a one-time draw for 22.9 ms on every scroll step.

The spike produced a more useful result than a feasibility answer. Drawing every edge would not help at the contract's default row order. Rows are ordered by start date, so a dependency lands anywhere in the list: the median edge spans 297 rows in a 1,000-row projection and 1,356 rows in a 5,000-row one, and both endpoints fall on one screen for 3.3 percent and 0.8 percent of edges respectively. At 5,000 rows, 99.2 percent of all-edge connectors would be vertical lines leaving the viewport at both ends.

The spike identified row ordering as a possible lever for graphical dependency reading. Graph-aware ordering would require a separate semantics review; existing field sorting does not supply it. Selected-row connectors were the proposed initial capability at this historical stage. The 2026-09-24 decision superseded that scope with complete anchored-edge display.

Not tested: orthogonal routing with collision avoidance, visual legibility at high edge density over a narrow span, and connector behaviour under a dependency-aware row order, which does not exist yet.

## Stage D Plan — 2026-09-22

The user gave go after reviewing the contract, confirming day resolution as sufficient and accepting the connector scope once the feasibility spike showed no architectural risk. [[planning/gantt-view-implementation-plan]] holds the Stage D deliverable: eight file-level work slices with per-slice acceptance criteria, compatibility notes, and verification gates.

The sequence puts Core first, separates the behavior-preserving temporal extraction from the Gantt projection so a reviewer never has to disentangle them, teaches every consumer to dispatch before any host renders a timeline, and keeps connectors and documentation as additive slices that can be reverted without breaking the feature. No slice adds a runtime dependency.

This completes the validation Task's deliverables. Three acceptance criteria were previously unmet and two are now addressed: the go conclusion is evidence-backed and an implementation plan with acceptance criteria exists, and the connector question is answered with measurement rather than deferral. The first criterion remains unmet and is the one genuine gate: the contract has no reviewer other than its author, and owner and reviewer assignment is still pending. Whether implementation runs under this Task or a new implementation Task also needs explicit authorization, as does committing any of this work.

## External Design Review Round 1 — 2026-09-22

An external review of [[proposals/gantt-temporal-view-contract]] raised five findings. Each was reproduced against the prototype output or the source before being accepted; all five held, and all are folded into the contract. The review round is recorded in the contract's Review Decision section, and the two findings that invalidated recorded evidence are corrected in [[design/gantt-view-validation-2026-09-22]].

Two findings exposed defects that the validation had not caught. The dependency graph was scoped to entries with usable dates, so the projection emitted an edge whose source appeared in neither the row list nor the unscheduled list, and a cycle passing through an unscheduled or invalid entry could not be detected at all. The six dependency states were not mutually exclusive: an entry declaring itself twice produced counts summing to three against two authored items. The arithmetic invariant had passed only because the oracle fixture happened to contain a single self reference and no repeated one. Both are now fixed, and the replacement per-item classification was verified to close across repeated self, outside-selection, unresolved, and mixed declarations.

Three findings were specification gaps rather than defects: finish-to-start conflict reporting was demanded of hosts without defining comparison rules and is now removed from this version, the collapsed binding diagnostic had no implementable shape against the existing single-path `Diagnostic` and now has one, and out-of-window predecessors were wrongly classified as unanchored in contradiction of the connector spike. The review also found year boundaries, left-edge viewport preservation, and very long spans unspecified for continuous scrolling; all three are now stated.

The review additionally caught two stale code references in [[planning/gantt-view-implementation-plan]]: `render_view_output` does not exist and the dispatch site is the mode match inside `render_view_definition`, and `crates/forma-core/tests/calendar_view.rs` holds ten tests rather than seven. Both are corrected, and the plan's slice 2 acceptance criteria now carry the new projection shape and the classification cases.

The contract remains `status: proposed`. This round was a design review of its content; recording it does not assign a reviewer in metadata, accept the contract, or authorize implementation.

## External Design Review Round 2 — 2026-09-22

Three further findings, all reproduced before being accepted, all fixed. Recorded in the contract's Review Decision section, with the evidence in [[design/gantt-view-validation-2026-09-22]].

The projection example violated four of its own invariants: `candidates` and `scheduled` disagreed with the node and row lists, and an edge referenced a node the example did not contain. An implementer copying it would have built the wrong thing. It is rebuilt as a complete valid instance covering all three node statuses and both edge statuses.

The revised classification and graph scope had been reported as verified on the strength of a rule-level check with no reproducible artifact. The generator still walked only scheduled entries, still counted duplicates and self references per distinct target, and still emitted no node list. A conformance checker now builds the projection from real Core output under the contract's rules and asserts every invariant, run against new fixture entries for a repeated self reference, a repeated outside-selection target, a repeated unresolved target, and cycles routed through an unscheduled entry and through a temporally invalid one. The superseded generator is retained unmodified and marked as such. The scope correction turned out to be measurable rather than theoretical: the checker finds three cycles where the superseded logic found one, because two of them route through entries with no usable interval.

Continuous scrolling had "no maximum range" where it needed a supported date range and boundary behaviour, and two-axis windowing reduces node count without reducing track width. Both hard limits are now specified: the four-digit-year temporal domain Core already enforces, and a measured renderer clamp — Chrome 152 honours 16,777,214 px and silently renders anything larger at exactly that width — which makes the full domain representable only at the smallest day width. Extension must stop at either limit and report that it stopped; a date jump outside the domain is rejected rather than clamped.

Both review rounds found real defects, and in both cases the underlying cause was the same: a fixture that did not contain the combination needed to expose the problem. That is worth carrying into implementation, where the acceptance criteria in [[planning/gantt-view-implementation-plan]] now name these combinations explicitly.

## Review Of External Fixes — 2026-09-22

An external revision reworked `conformance.py` and the contract together. The changes were read, run, and checked against the contract rather than accepted on a passing exit code. All of them are improvements, and several correct defects in what preceded them.

The classification helper no longer walks authored items positionally. The superseded version paired authored items with retained references by popping a queue, which silently assumed every unresolved item sat at the end and invented a pairing the index cannot support. The replacement counts unresolved by subtraction and classifies the retained references in their held order, which produces identical counts without claiming positions it cannot know. Edge identity became the compact JSON serialisation of `[from, to]`, which removes the collision a legal path containing `->` would cause. Anchor status now requires both endpoints to be scheduled, because a connector needs two ends, and the contract's Anchored definition was corrected to match. Cycle reporting moved from first-back-edge traversal to strongly connected components, which is deterministic, merges overlapping cycles correctly, and avoids the exponential cost of enumerating simple cycles at Gantt's target scale.

The checker itself is materially stronger. It now verifies status partitions, that rows and scheduled nodes are the same set, that every edge agrees with its endpoints' states, that edge identities are canonical, and that emitted predecessors and edges correspond — rather than arithmetic totals and endpoint existence alone. It also parses the contract's JSON example and asserts the invariants against it, so the example is machine-checked on every run, and carries negative controls proving the checker rejects the specific defects earlier review found. A `--write` gate stops it overwriting saved measurement inputs by default.

Two residual problems were found and fixed. The contract still opened the classification rule with a positional walk over authored items, including a bucket keyed on which item produced no reference, thirty lines before forbidding exactly that inference; an implementer reading in order would have built the rejected behaviour. The rule now states the aggregate form as normative. Separately, the saved projection artifacts still carried the superseded `->` edge identities, so the evidence on disk contradicted the contract it was meant to support.

Fixing the second required running the checker with `--write`, which changed files the external revision had deliberately left historical. The validation record said that rerun was done without overwriting; it now states what is true, that those two projection files hold the corrected wire shape while every other saved artifact, including all browser measurements and the generated prototype pages, predates it.

## Implementation Handoff — 2026-09-22

At this handoff stage, the user authorized taking over implementation. Core projection, shared contracts, consumer dispatch, static and VS Code lists, the windowed WebApp timeline, initially selected-row connectors, examples, and product documentation were implemented with no new runtime dependencies. Later connector changes and current validation boundaries are recorded in [[planning/gantt-view-implementation-plan#Implementation Record — 2026-09-22]] and the release preparation record.

Full repository checks, example checks, workspace diagnostics, deterministic static builds, and real-backend Chromium/Firefox/WebKit checks passed. This records implementation progress only: Task lifecycle metadata, ownership, product acceptance, and commit authorization remain unchanged. Installed-host and real screen-reader acceptance are still separate from the completed local checks.

## Implementation Review — 2026-09-22

The Gantt implementation was reviewed against [[proposals/gantt-temporal-view-contract]] and [[planning/gantt-view-implementation-plan]]. All eight planned slices are present and wired, no dependency manifest or lockfile changed, and `mise run check` passes.

Core matches the contract on every rule that earlier review rounds had to correct. Unresolved dependencies are counted by subtraction and the retained references are classified by the contract's precedence; the node list spans every selected candidate rather than only entries with usable intervals; edge identity is the compact JSON pair; anchoring requires both endpoints to be scheduled; cycles are reported as strongly connected components, using an iterative Kosaraju that avoids the recursion limits and the quadratic reachability of the local checker; binding-type failures collapse into one View-level diagnostic carrying the affected count with at most ten samples; a non-boolean milestone value produces no Gantt diagnostic; and no conflict between a relation and the dates is computed anywhere.

Rendering the 40-entry oracle fixture through the real `gantt` mode satisfies every contract invariant, reproduces all three named dependency combinations, and reports all three cycles including the two that route through an unscheduled and a temporally invalid entry.

That run also settled a rule the local checker had explicitly been unable to prove. Bound to `fields.predecessors`, Core assigns the nested-path entry zero declared dependencies; bound to `fields.plan.predecessors`, it assigns exactly that entry one and ignores every top-level declaration. Exact-field matching holds in both directions. The discrepancy surfaced as a phantom seventeenth edge from the checker, whose fixture adapter combined both field names; the checker has been narrowed to a single bound field and now agrees with Core at sixteen edges.

The WebApp meets the rendering rules and improves on two of them. Keyboard support uses a roving `aria-activedescendant` grid with focus held on the scroller, which removes by construction the focus-loss failure that windowing caused in the prototype, and `aria-rowcount` and `aria-rowindex` describe the full row list rather than the window. The complete list is an always-present disclosure rendered lazily, which is the allowed form. Left-edge extension compensates the scroll offset in a layout effect before paint. Beyond the contract, the component validates measured track geometry after layout and falls back rather than displaying a distorted track, and when the extent cannot fit it disables navigation and states that the timeline is unavailable while keeping every entry reachable.

The original review overstated a geometry divergence: bars use fixed-epoch day values in CSS calc expressions with --gantt-origin and --gantt-day; they are not positioned solely by JavaScript. Track width is derived in JavaScript, and month-label visible-intersection positioning is a separate imperative DOM concern. This is not evidence that the bar-position contract should be relaxed. The materialized-width budget is deliberately below measured engine clamps, bounding a 28-pixel-per-day timeline to roughly a century; unavailable states are reported explicitly.

A suspected off-by-one at the upper date boundary was investigated and does not exist. Rejecting a jump to `9999-12-31` is correct, because interval ends are exclusive and Core already rejects a date-only entry ending on that day. The contract states this more precisely than the review did, including that a datetime interval ending at local midnight on that boundary can still be valid, and requires the renderer budget to be validated across engines rather than generalised from one measured Chrome threshold.

One coverage gap was found by tracing the collapse paths rather than the tests, and has since been closed. `render` routes two temporal binding failures into the aggregated form — an unsupported start or end schema type, and start and end types that disagree — but the collapse test exercises only the dependency and milestone bindings. Both temporal paths were probed directly against a fifteen-candidate workspace and behave correctly, emitting one View-level diagnostic carrying `actual` of fifteen plus ten samples, with every candidate counted invalid. The behaviour is right; the test was missing.

`temporal_binding_failures_collapse_like_auxiliary_bindings` now covers both. It asserts one View-level diagnostic located on the View carrying the affected count, at most ten samples, that every sample keeps a frontmatter location, and that a set smaller than the cap is sampled completely. Its effectiveness was checked by mutation rather than by a passing run: removing the sample cap and routing temporal failures per candidate each make it fail, and the source was restored byte-identically afterwards. `mise run check` passes.

Static output and the shared contract were checked as well. The static list covers every node rather than only rows, states unscheduled and invalid entries as such, links only to nodes the projection contains so no broken link can be produced, reports hidden dependency counts without naming their targets, escapes titles under an injection test, and states that no scheduling conflicts are computed.

Committed as `217fa2e`.

## Bar Labels, Progress And Connector Routing — 2026-09-22

The user requested three additions and corrected an inaccuracy: the documentation had grouped dependency routing with bar titles and progress fills as "not included in this initial implementation", which understated connectors, since selected-row polylines already existed. That sentence is removed and the surrounding text now describes what each surface actually does.

**Bar labels.** A bar carries its entry title, clipped to the bar and hidden from assistive technology, because the row's accessible name already states title and range and the sticky column names every row. Bar geometry still answers to dates only, so a bar too narrow to read shows nothing rather than widening.

**Progress.** This extends an accepted public DSL, so the contract was amended first. `gantt.progress.field` binds a scalar `integer` holding whole percent from `0` through `100`. The integer requirement is what makes the range safe: under a ratio convention `0.4` would silently mean less than one percent, whereas here existing schema validation rejects it before Gantt sees it, exactly as it already does for a non-boolean milestone. A value outside the range is diagnosed through `view.ganttProgressInvalid` and dropped, never clamped, and an authored `0` is a value while an absent field is not. Progress describes the entry rather than its schedule, so it sits on the node: an unscheduled entry carries it and the read-only surfaces state it, while only a scheduled row can render a fill. The fill covers part of the bar and never changes where the bar starts or ends, so progress cannot be misread as schedule. The getting-started example gains no progress data, on the same grounds that it gained no invented dates.

**Connectors.** The audit found three real gaps rather than an absence. Connectors had no arrowhead, which leaves a finish-to-start edge stating that two entries are related without stating which precedes; they are now directed. Any endpoint outside the rendered row window dropped the whole connector, although the geometry is arithmetic and the overlay already spans the full height, so an absent connector could be read as an absent dependency; off-window endpoints are now drawn. A fixed elbow doubled back through both bars whenever a successor started before its predecessor ended, which is ordinary data because no conflict is computed; that case now routes around.

Verification: ten Core tests including range, zero, absence, out-of-range diagnostics, the schema-rejected ratio, unscheduled carriage, and collapsed binding failure; thirteen WebApp tests including label decoration, fill independence from bar extent, the zero-versus-absent distinction, arrowhead presence, off-window drawing, and both routing shapes. `mise run check` passes. End-to-end CLI rendering of a four-entry workspace reproduced every case, including an out-of-range entry that keeps its interval and loses only its progress.

## Browser Review Findings — 2026-09-22

Three observations from viewing the running WebApp against a fifteen-entry demonstration workspace. One was a defect, two were designed behaviour whose consequences are worth stating.

**The progress fill cost the bar label its contrast, and is fixed.** The fill was a full-height wash behind the title, so the label sat on a darkened background wherever progress had been authored. A bottom band was tried first and rejected on review: it read poorly, and the full fill is what makes progress legible at a glance. The fill is therefore full height again, and the label is drawn twice instead — once for the unfilled background and once clipped to the fill, each copy coloured to contrast with what is behind it. Both copies share a box, so the glyphs align exactly and the seam falls where the fill ends.

Measured across all thirteen filled bars: every fill width matches its authored percent within one percent, and every clip boundary matches its own fill exactly. Both themes invert correctly, with a dark fill carrying white text on light and a light fill carrying dark text on dark. The contract states the constraint and a test pins the two-layer label and its clip.

**The connector scoping is now opened up by row count.** Below sixty rows every anchored edge is drawn without a selection; above it only the selected row's edges are, as before. Sixty is a judgement rather than a measurement and is named and reasoned about in the source: the 1000-row measurement showed that drawing every edge was noise, no intermediate size was measured, and sixty rows is roughly three viewports of track, so a connector still reads as a thread a viewer can follow. It should be revisited against real workspaces rather than treated as derived. A test pins both sides of the threshold, and the small-projection case incidentally confirms that off-window endpoints draw, since only about half the rows are in the document at that size.

**Before that change, fewer connectors than expected was the design, not a rendering fault.** Connectors render only for the selected row, so the count follows the selection: a row with one edge draws one. That scoping came from a measurement at one and five thousand rows, where ninety-nine percent of all-edge connectors would have joined two points that cannot share a screen. At fifteen rows that justification does not apply and every edge would be readable, so the restriction is right for the workspaces it was measured against and arguably over-restrictive for small ones. Worth revisiting as a threshold or a toggle rather than leaving as a silent constant.

**Sub-day resolution stays out of scope by decision.** The behaviour below is what the day-resolution contract specifies, and it will not be changed.

**Sub-day tasks are supported in data and rounded to whole columns in the bar, by design.** Day resolution means a bar occupies the calendar dates its interval covers. A two-hour task and an eight-hour task within one day both occupy one column, and a four-hour task crossing midnight occupies two, so it draws wider than the eight-hour task. The exact instants are preserved in `temporal` and stated in the range label, so nothing is lost, but the bar does not express duration below a day. If sub-day extent ever needs to be visible, that is a resolution decision rather than a rendering fix, and it is currently out of scope.

Four demonstration entries with long titles and progress of ten, twenty-five, fifty and eighty-five percent were added so the label-over-fill seam could be judged directly. Measured across them, both label layers align on each axis to within half a pixel, and the seam falls inside the glyphs at ten and twenty-five percent, fifty-seven and one hundred seventy-five pixels into labels of roughly two hundred fifty pixels. At fifty and eighty-five percent the fill is wider than the text, so the whole label sits on it.

## Review Round On Labels, Progress And Connectors — 2026-09-22

Four findings, all reproduced before being accepted, all fixed.

**Progress existed only as a fill and therefore only as decoration.** The fill lives inside an `aria-hidden` bar, so it reached no screen reader, no selection detail, and no complete list; an unscheduled entry, which has no bar at all, showed nothing. The percent is now stated in the row's accessible name, the selection detail, and the complete list. The WebApp and the VS Code preview share one formatter and so cannot drift apart; the static export builds the same sentence independently in Rust, where the shared formatter cannot reach it, and nothing pins that phrasing, so the two can drift. The static export's Gantt arm is tested for determinism, escaping and link safety, but through the shared wire fixture, whose source view configures no progress binding, so the percent string is the one part of that arm no test reaches. The same absence runs through every consumer of that fixture: progress is a new field on the wire contract and the fixture does not carry it. Recorded here rather than closed, because giving it coverage means configuring progress in the example workspace and regenerating the fixture, which is a product-example change of its own. That work, and the wider fixture gap it belongs to, is now [[tasks/cover-temporal-view-contract-in-committed-fixtures]]. The formatter returns an empty string when no progress was authored, which is what keeps an absent value from reading as zero.

**The milestone marker covered the start of the bar's title.** The marker is drawn at the bar's start, which is exactly where the label begins. The label now reserves room for it. The indent is text-only: bar extent still answers to dates, and a test asserts both the indent and that the width expression is unchanged.

**The off-window connector test did not test an off-window endpoint.** It built two rows, both inside the render window, so it asserted nothing about windowing. It now builds a 100-row projection with endpoints far enough apart that row windowing cannot mount both, and asserts that the far row is absent from the document while the connector still exists. Its effectiveness was checked by mutation: reinstating the endpoint-window guard makes it and the edge-visibility test fail, and the source was restored byte-identically.

**The contract had drifted from the implementation in two places.** The surface matrix and two supporting statements still described connectors as scoped to the selected row, which the row-count threshold replaced, and a follow-up item still called the two temporal binding collapse paths untested although those tests had been added. Both were corrected at that review point; the user's 2026-09-24 decision later removed the row-count threshold and restored full anchored-edge rendering. The contract also gained the two rules this round produced: progress must be stated as text and not only drawn, and a marker must reserve room rather than cover the title.

Seventeen WebApp tests pass and `mise run check` passes.

## Selecting And Locating A Row — 2026-09-22

The user asked whether clicking a row title should scroll its bar into view. A first attempt tied locating to a single click and skipped bars that were already partly visible. The user rejected both parts: a gesture that sometimes does nothing is harder to trust than one that always repositions, and putting it on single click collides with selection.

The separation is now explicit. Single-clicking a row's title or its bar selects that row and moves nothing, and keyboard arrow traversal does not scroll horizontally either, so browsing rows never sends the viewport chasing bars across years. Double-clicking a title or a bar locates that row, putting its bar start two day columns in from the left edge of the track. Locating is unconditional, so a partly visible bar still moves and the bar head always lands in the same place. The lead-in is counted in columns rather than pixels, so it is the same span of time at every day width: the viewer always sees the two days before the bar begins, whether a day is four pixels or forty-eight. A fixed pixel lead-in was written first and changed on the user's instruction, because at four pixels per day it left no readable context and at forty-eight it left only one column.

Three tests cover it, and the mutation pass caught a real gap in one of them. The first version of the unconditional assertion moved the viewport far enough that the bar had left the screen entirely, so reinstating a visibility guard did not fail it: the test looked correct but proved nothing. Nudging the viewport to where the bar is still partly visible is what distinguishes the two behaviours, and with that change the guard mutation fails as it should. Adding a locate call to the single-click path fails its own test.

The move to columns produced a second self-referential test, caught the same way. The new assertion derived its expected offset from the very constant the implementation reads, so changing the lead from two columns to three moved both sides of the equation together and twenty tests still passed; only the unrelated mutation back to fixed pixels failed. Writing the column count as a literal in the expectation fixes it, and both mutations now fail. The lesson is narrower than the earlier one: an assertion that imports a constant to describe a value that constant defines is not a test of that value, however much arithmetic surrounds it.

Verified in the running WebApp: a single click selected without moving the offset, a double-click located the bar, repeating it from a different offset landed on the identical value, and clicking a bar selected its row. The column lead was then measured at three day widths by double-clicking the same far-right row and reading the rendered gap between the track's left edge and the bar's left edge: nine pixels at four per day, fifty-seven at twenty-eight, ninety-seven at forty-eight. Each is two columns plus one pixel, the extra pixel being the title column's right border, which sits outside the measured rect.

## Connector Overlap — 2026-09-23

The user asked whether dense timelines could be improved, and then whether a layout library would help. Both were answered by measuring rather than by argument, on synthetic dense fixtures of 8 through 56 rows and on the demo workspace, replicating the component's path geometry exactly.

Two things the earlier record got wrong are corrected here. Long horizontal runs were described as overlapping in dense charts; they do not. A long run sits on its target row's centre line, so only edges arriving at that same row can share it, and overlap between different successors measured zero on every fixture. What does overlap is the horizontal stub at the source, which is eight pixels long and leaves the same bar, so it reads as one line correctly.

What the measurement found, and what it turned out to mean, are two different things, and the difference is the most useful part of this round.

A riser passes straight through whatever bar sits between its endpoints, and that scales: one crossing per edge on the demo, 7.3 at 56 rows. That is a genuine defect and it is recorded below as unfixed.

The first connector sweep reported that 21 to 27 percent of riser centerline length was covered by more than one edge. This is shared coverage, not a collision rate: it combines expected fan-out trunks with overlap between independent routes. Edges from one predecessor whose target rows lie on the same side share the riser from their origin to the nearer target; “same direction” here means vertical direction in rendered row order, not date order. Risers from different origins can share a positive-length segment only when they occupy the same track coordinate and their row intervals overlap by positive length. Opposite-side branches from one origin meet only at their common endpoint on the centerline. The historical analysis did not preserve a repeatable classifier or an explicit denominator for these classes, so the previously reported split is not reproducible and no revised percentage is claimed.

The aggregate metric therefore overstates the problem if read as the proportion of defective routing. Retire it as a collision measure and optimisation target; a future comparison must state its geometric classification and denominator.

Lanes were introduced after that aggregate metric and remain for a separate presentation rationale: they are intended to make the fan-out at a bar easier to distinguish, not to correct a measured collision defect. The six-lane limit and three-pixel step survive because they follow geometric boundaries rather than the retired percentage: eight lanes reached past a successor's start, and a four-pixel step realigned connectors from different predecessors by resonating with the four-pixel day, measuring worse than no lanes at all. The earlier lane-versus-overlap percentages described the pre-clamp implementation and counted shared trunks, so they are retired rather than used as a quality score. The clamp and its narrow-gap invariant are recorded below.

One further claim in the original record was wrong. Six lanes were said not to overshoot at any day width, which held only for overshoot defined as passing a successor's start. Measured against the eight-pixel approach the clamp now reserves, six ate three to eight pixels of that approach on two fixtures. The narrow-gap correction below is what makes the invariant hold rather than merely happen to hold.

### Narrow-Gap Correction — 2026-09-23

Review found a case the original fixture missed. At four pixels per day, a successor starting four days after its predecessor ends places the direct-route endpoints exactly sixteen pixels apart. The fourth lane (lane index 3) would sit one pixel beyond the successor start, making the final arrow approach run backward. Direct lanes are now capped to the available corridor after retaining an eight-pixel approach; if only the base riser fits, those edges share it. Routes around overlapping or closer-starting successors use the base riser so lane offsets do not worsen the return segment.

Three component regressions cover the minimum direct gap, a short corridor with partial lane capacity, and overlapping-successor detours. Each failed before the correction and passed afterward. Existing fan-out, selection-stable lane assignment, and ordinary direct/detour route checks remain green; the code change only constrains lane offsets, not route selection or dependency semantics.

The lane is numbered over every anchored edge, not the drawn subset, so selecting a row cannot move a connector already on screen. The mutation that checks this took three attempts to write honestly: the first was a temporal dead zone error that broke unrelated tests rather than testing anything, the second was neutralised by the memo's dependency list so the stale lane map still held the right answer, and only the third — filtering inside the loop and adding the selection to the dependencies — actually failed. Removing lanes, changing the count, and changing the step each fail as well.

Riser-through-bar is recorded as a known limitation, not fixed. Obstacle-avoiding routing was assessed and rejected on evidence: in the corridor between a predecessor's end and a successor's start, 69 and 70 percent of edges on the dense fixtures have no column free of bars in every row the riser passes, and 33 percent even on the demo. Canvas occupancy is only a quarter; the constraint is that routing needs one column free across many rows at once, and that intersection empties as charts grow taller. A router would convert a clean one-pixel crossing into a long detour for most edges.

Dagre and ELK were considered by name and do not apply. Their value is deciding where nodes go, and both Gantt axes are already determined by contract: x by the configured date bindings, y by the configured sort. ELK's orthogonal routing is tied to the layered algorithm's own node placement, and its fixed-position algorithm does not route that way; Dagre has no fixed-position mode at all. This is not a dependency-budget objection — the graph View uses graphology and forceatlas2 precisely because node positions are the unknown there, and elkjs is already in the tree through `beautiful-mermaid`. The objection is that the libraries solve a problem this View does not have.

At the time of this review, `ALL_EDGES_MAX_ROWS` was intentionally retained as a judgement rather than a measurement; data showed 7.3 crossings per edge at 56 rows, but changing the threshold was outside that review's scope. The user later removed the threshold on 2026-09-24 and chose complete edge display, deferring high-density visual optimization.

## Locate Review Round — 2026-09-22

An external review raised two P2 findings against locating, both confirmed.

**Locating could not reach a bar lying past the end of the current track.** Reproduced at four pixels a day on the last row of the demo workspace: the offset the lead-in asked for was 2112 while the track allowed 1696, so the write clamped and the bar head sat 616 pixels into the track instead of nine. Repeating never improved it, and the reason is worth recording, because it is the part the review had not identified: the scroll handler only extends the range when the offset actually changed, and a clamped write leaves the offset exactly where it was, so the extension never fires and no number of repeats gets closer. The review saw two different values because their first attempt did move the offset and bought one extension; the underlying trap is the same. Locating now widens the range first, anchored on the lead-in column so that both the columns before the bar and a viewport of track after it exist, and applies the offset through the pending-scroll path the date jump already used. One gesture is now enough. Where the range cannot widen — at the end of the supported domain, or against the size budget — the clamp stays, because that is the real boundary.

**Locating had no keyboard equivalent.** Enter with the grid focused now locates the selected row. Arrow, page, Home and End keep selecting only, so traversal still never scrolls horizontally, and the help line under the grid says what Enter does.

The user then asked whether locating should place the row vertically as well. It now centres the row in the band the sticky header leaves, on both the double-click and the Enter path, which is the same rule the horizontal axis already followed: always the same landing place, never a conditional nudge. Near the ends of the list the browser clamps, and unlike the date range there is nothing to extend, so that clamp is the honest answer.

Three tests cover the round and each was checked by mutation. Reverting to the direct write fails the boundary test with the exact pair of numbers the browser produced; removing the Enter branch fails the keyboard test; removing the vertical write, or centring without accounting for the sticky header, each fail the centring test. The boundary test needed a scroller that clamps, since jsdom has no layout and keeps whatever offset it is given, and it asserts that the target really does exceed the reachable offset so that a future fixture cannot let it pass while exercising nothing.

Two method notes. Measuring in the browser by clicking at computed screen coordinates produced three wrong readings in a row: a row misidentified by twenty-three pixels, a double-click that landed on a link and navigated away, and a measurement taken on a different row's bar than the one that had been located. Each looked like a fresh defect and none was. Dispatching the event on the resolved element and reading back the row the component reports as active removed the noise. Separately, a stale viewport width was suspected and fixed on the way — the observed width lags a layout change until the observer or a scroll fires, and reserving track against it left too little — but that fix alone did not change the reading; the real defect was the clamp. The three range anchors now measure the live client width regardless, since none of them can afford a stale number.

Verified in the running WebApp after the fix: at four pixels a day, both Enter and double-click put the last row's bar head nine pixels into the track in one gesture, with the range extended from 453 to 1085 reachable pixels. Vertical centring was measured in a shortened viewport, since the demo workspace's nineteen rows otherwise fit without scrolling: the located row's centre landed at 201 pixels from the grid top against a band centre of 200.

**Connectors were drawn across the sticky title column.** The user spotted it on the row below Environmental monitoring. A dependency whose successor starts before its predecessor ends routes backwards, and that leftward run lies at a row boundary and extends to wherever the successor's bar begins; once the view is scrolled past that point the run sits under the title column, and it was painted over it. The same happens vertically against the sticky header, which was reproduced by shortening the viewport until the row list could scroll that far.

Stacking order does not fix it. The title cells already carry a higher z-index than the connector layer and an opaque background, and raising them further, to thirty, changed nothing. The layer is now clipped to the track instead, at the current scroll offsets on both axes, which needs no assumption about paint order. The clip is applied on the same scroll frame that repositions the month labels rather than from render state, so a fast scroll cannot flash a connector across a sticky edge; a first attempt asserted this through a horizontal scroll, and the mutation pass showed that a horizontal scroll also re-runs the render path, which was covering for the frame. Scrolling only vertically isolates the frame, because nothing the render path watches changes.

Verification followed the same pattern as the rest of the round. The clip module has unit tests for the offsets, the header band, overscroll and a timeline with no connector layer, and the component has one test for mount and scroll. Removing either call site, dropping the header band, and clipping only one axis each fail. In the browser the connector that previously ran the full width of the title column now stops at its right edge, at the same scroll offset, and the same holds for the header after the viewport is shortened.
