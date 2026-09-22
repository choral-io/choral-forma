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
status: backlog
readiness: blocked
owners: []
assignees: []
reviewers: []
tags:
    - views
    - gantt
    - validation
blockedBy:
    - tasks/define-temporal-view-contract
relatedTo:
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

- [ ] Reference the reviewed temporal contract and assign an owner/reviewer. Make sample provenance, synthetic/real-data boundaries, and field coverage verifiable.
- [ ] Demonstrate stable bar positioning across DST, month boundaries, and different workspace timezones without inventing unknown dates.
- [ ] Provide examples of dependency-edge semantics and exceptional-case diagnostics, explaining the benefits and complexity of graphical connectors relative to lists and the initial choice.
- [ ] Record actual evidence for long titles, overlapping spans, narrow screens, keyboard navigation, light/dark themes, and host-local scrolling.
- [ ] Record performance samples, output/DOM size, bottlenecks, and whether windowing is necessary. Do not promise performance against unmeasured thresholds.
- [ ] Produce an evidence-backed go/no-go conclusion. If successful, provide a Gantt implementation plan with acceptance criteria; otherwise document missing data/value evidence or complexity limits. Subsequent implementation task creation and publication remain subject to the authorization in effect at that time.
- [ ] Add no runtime dependencies and make no unreviewed changes to production modes or public DSL.

## Readiness

The Calendar portion of [[tasks/define-temporal-view-contract]] is accepted and implemented at `afc3bc7`; its temporal semantics are available for reuse. Gantt validation and independent design review are recorded below, with the corrected contract ready for implementation handoff. Owner/reviewer assignments and explicit implementation dispatch remain pending. Existing backlog / blocked metadata is preserved until an explicit lifecycle decision. Calendar release or full host acceptance is not a prerequisite for isolated Gantt validation. Gantt production implementation has not begun or passed delivery review.

## Independent Review Closure — 2026-09-22

The independent follow-up review corrected the remaining inconsistencies in [[proposals/gantt-temporal-view-contract]] and [[planning/gantt-view-implementation-plan]] and reran the strengthened local conformance checks. The complete projection example, both endpoint states, dependency accounting, cyclic components through unscheduled/invalid nodes, and negative controls pass; evidence boundaries are recorded in [[design/gantt-view-validation-2026-09-22]]. The Core temporal boundary and browser-size fallback now have explicit implementation acceptance criteria.

No unresolved design blocker remains for handoff. This is not production delivery acceptance: there is no Gantt implementation yet, and production Core/consumer tests, cross-browser layout checks, and installed-host/accessibility validation remain required. Owner/reviewer assignment and implementation dispatch remain for the user. Existing lifecycle and assignment metadata is unchanged; no commit or external handoff was performed.

## Development Preparation — 2026-09-21

Historical stage notes below are preserved as evidence. The latest assessment is the Independent Review Closure section immediately above them.

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
- Navigable predecessor lists are the accessible baseline. Compare optional SVG connectors for a selected row against lists using chains, branches, cycles, and dense graphs. Do not claim graphical dependency validation if only lists were exercised. Defer all-edge rendering and complex routing unless evidence warrants them.

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
- Rendering: 1440/1024/768/390 px, light/dark, long titles, multi-year spans, many rows, empty/unscheduled/all-invalid sources, local scrolling, range continuation, keyboard focus, source navigation, and clean browser logs. Use playwright-cli across Chromium, Firefox, and WebKit; report real Safari/mobile and installed VS Code host gaps separately.
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

The lever for graphical dependency reading is therefore row ordering, not connector rendering or routing. A dependency-aware order is a sort concern the existing `sort` field already accommodates, so pursuing it later stays additive and needs no change to the projection, the geometry, or the layout. Connectors for a selected row remain the proposed initial capability, and deferring the rest costs nothing.

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

The user subsequently authorized taking over implementation. Core projection, shared contracts, consumer dispatch, static and VS Code lists, the windowed WebApp timeline, selected-row connectors, examples, and product documentation are implemented in the working tree with no new runtime dependencies. Detailed evidence and remaining validation boundaries are recorded in [[planning/gantt-view-implementation-plan#Implementation Record — 2026-09-22]].

Full repository checks, example checks, workspace diagnostics, deterministic static builds, and real-backend Chromium/Firefox/WebKit checks passed. This records implementation progress only: Task lifecycle metadata, ownership, product acceptance, and commit authorization remain unchanged. Installed-host and real screen-reader acceptance are still separate from the completed local checks.
