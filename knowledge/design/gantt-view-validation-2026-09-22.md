---
schemaVersion: 1
scope: project
type: technical-assessment
title: Gantt View Validation — 2026-09-22
summary: Stage B and C evidence for the proposed Gantt contract, including real Core oracle results, layout defects found and corrected, measured scale, and a go/no-go conclusion.
owners: []
reviewers: []
tags:
    - gantt
    - views
    - validation
sources:
    - proposals/gantt-temporal-view-contract
    - tasks/validate-lightweight-gantt-view
---

# Gantt View Validation — 2026-09-22

## Independent Review Closure

The subsequent independent review corrected remaining specification/plan disagreements without touching production code or dependencies. An edge is anchored only when both endpoints are scheduled. The timeline's upper bound is exclusive, matching Calendar's normalization; browser size limits require cross-browser verification and explicit complete-list fallback, not extrapolation from a Chrome-only measurement. Locale handling, all-node visibility, connector status, stable edge identity, and complete cycle membership are aligned in the contract and implementation plan.

The local `conformance.py` was strengthened and rerun without overwriting saved projection artifacts. Full selection passed with 40 nodes, 27 rows, 17 edges and three cyclic components; filtered selection passed with 30 nodes, 21 rows and nine edges. The canonical JSON example, mixed repeated self/outside/unresolved cases, overlapping-cycle membership, and negative controls for an incorrect edge status and missing node also passed. The checker now validates actual status partitions, scheduled-row identity, edge/predecessor correspondence and both endpoint states, rather than arithmetic totals alone.

Reproduce from the repository root with `python3 knowledge/workspace/tiscs/local/scratch/gantt-validation-20260922/conformance.py`. This local-only artifact is not a shared dependency of implementation: the plan carries the required cases, which must become committed production tests. The command is read-only by default; `--write` explicitly regenerates prototype projections. It was run once with `--write` during the review of that revision, so `gantt-projection-full.json` and `gantt-projection-filtered.json` now hold the corrected wire shape with canonical edge identities and strongly-connected cycle components; before that run they still carried the superseded `->` edge identities. Every other saved artifact, including all browser measurements and the generated prototype pages, predates the corrected shape and is not retroactively a measurement of it.

Evidence boundary: this checker consumes saved Core outputs. Its fixture-only source parser and combined `predecessors`/`plan.predecessors` input are not a general YAML parser or proof of exact single-binding behavior. Its reachability-based cyclic-component oracle is suitable for the small fixture, not a production performance model. Exact-field isolation, general schema/value handling, Core Gantt serialization and diagnostics, boundary-date integration, and browser materialized-size budgets remain named implementation tests. No fresh browser or production Gantt benchmark was run in this review.

Assessment: no unresolved design blocker after the corrections; the design is suitable for implementation handoff. Product acceptance, Task metadata changes, implementation dispatch and commits remain separately authorized. Earlier statements below about a missing independent review describe the historical stage, not this closure.

## Candidate

Historical scope: this section and the prototype measurements below describe the pre-implementation baseline. Production Gantt now exists in commit `217fa2e`; its later evidence and remaining limits are recorded in [[planning/gantt-view-implementation-plan]]. Prototype measurements must not be relabeled as production benchmarks.

Stages B and C of [[tasks/validate-lightweight-gantt-view]], run against the contract in [[proposals/gantt-temporal-view-contract]] under the user's approval of the bounded A–C validation effort. Baseline `afc3bc7`. No production View mode was registered, no dependency was added, no production source file was changed, and nothing was committed. The working tree carries only Markdown: this record, the contract, and the Task's own progress sections.

Gantt Core does not exist. Everything measured here is either the existing Core behavior the contract reuses, or an isolated prototype. No number in this record is a Gantt implementation benchmark.

## Method

The oracle fixture is a real Forma workspace, not prototype-only data. Because the contract reuses Calendar's temporal normalization and the existing indexed-reference resolver verbatim, both halves were exercised through the existing `calendar` and `graph` View modes on that workspace. That yields genuine Core results for the reused behavior without registering a Gantt mode.

The fixture uses a neutral exhibition-preparation domain at the nonstandard configuration path `config/`, with fields `startsOn`, `endsOn`, `startsAt`, `endsAt`, `isMilestone`, `predecessors`, and `plan.predecessors`. Workspace timezone is `America/New_York` so the DST cases are genuine 23 and 25 hour local days. 33 preparation entries and 2 catalogue entries cover every case in the contract's verification table. Seven Views bind the same entries in different ways, including two deliberately misconfigured ones.

The layout prototype consumes the real Core output, re-shaped into the proposed projection. Scale fixtures are seeded with `20260922` and recorded in a manifest.

## Temporal Results

Every contract expectation held against real Core output.

| Case | Authored | Core result |
| --- | --- | --- |
| Leap day, no end | `2028-02-29` | `2028-02-29` → `2028-03-01`, one column |
| Nonexistent leap day | `2027-02-29` | `view.calendarDateInvalid`, excluded, not rolled into March |
| Year boundary | `2027-12-28` … `2028-01-03` | Seven columns, one row |
| DST short day | `2026-03-08T00:00:00-05:00` … `2026-03-09T00:00:00-04:00` | 23 elapsed hours, exactly one covered date |
| DST long day | `2026-11-01T00:00:00-04:00` … `2026-11-02T00:00:00-05:00` | 25 elapsed hours, exactly one covered date |
| Instant crossing local date | `2026-09-21T02:00:00Z` | Occupies `2026-09-20` in `America/New_York` |
| End at local midnight | `2027-04-05T09:00-04:00` … `2027-04-08T00:00-04:00` | Covers April 5–7, excludes April 8 |
| Reversed, orphan end | — | `view.calendarIntervalInvalid` with the correct distinct message |
| Mixed endpoint types | date start bound against datetime end | `Start and end schema types must agree` |
| String field holding a date | `"2028-02-29"` under a `string` schema | `view.calendarFieldTypeInvalid`; no date inference |

Counts closed at every binding: 33 candidates = 22 scheduled + 7 unscheduled + 4 invalid for the date binding, and 33 = 5 + 26 + 2 for the instant binding.

Two facts emerged that the contract had not stated correctly.

**Workspace schema validation already rejects several authored values.** A non-boolean milestone reports `schema.type.invalid`, an empty date string and an offset-free datetime report `schema.format.invalid`, and an unresolvable reference reports `entryRef.unresolved`, all at `forma check` time. A well-formed but nonexistent calendar date such as `2027-02-29` is not caught there, because the date schema check is lexical. Gantt-level value diagnostics therefore exist only for values the schema layer permits.

**One wrong binding produces one diagnostic per candidate.** A deliberately mismatched date-start and datetime-end binding produced 33 identical `view.calendarIntervalInvalid` warnings over 33 candidates, including entries where neither bound field was populated, because schema types are compared before values are read. The per-entry check is correct in principle, since different entries can carry different applicable schemas, but at Gantt's target scale one configuration mistake would emit thousands of identical diagnostics. The contract now requires collapsing binding-type failures that share a code, field, and reason into one View-level diagnostic with an affected-candidate count.

## Dependency Results

The `graph` mode produced 13 edges over 33 nodes, matching the expected chain, branch, join, nested-path, unscheduled-target, and invalid-target cases. Three behaviors were confirmed directly.

- A dependency bound to `plan.predecessors` resolved with `field=plan.predecessors`, confirming that dotted frontmatter paths address nested reference fields and that list schemas flatten onto the same path.
- `depends-unresolved` produced no edge at all, only `entryRef.unresolved`. This confirms that an unresolvable target is invisible to any consumer of resolved references.
- A body wikilink to another row produced no edge, because the configured rules are field-scoped.

Three defects in the proposed model were found and corrected.

**Resolved targets must be counted from index references, not from edges.** `duplicate-dependency` declares the same predecessor twice. The index retains both references; Graph-style edge assembly collapses them to one. Deriving `unresolved` as declared minus edges therefore reported a duplicate declaration as an unresolved target. Counting index references fixes it.

**The four-state model does not balance.** With `declared` counting authored entries, a duplicate declaration and a dropped self reference each disappeared from the arithmetic, so a reader could not distinguish a hidden predecessor from a lost one. Adding explicit `duplicates` and `selfReferences` counts closed the invariant across both projections.

**That closure was luck, and external review caught it.** The counts were computed per distinct target rather than per authored item, which makes the buckets overlap: an entry declaring itself twice yields `duplicates = 1` and `selfReferences = 2` against `declared = 2`. The oracle fixture contained only a single self reference, so the invariant test passed without exercising the overlap. The contract now specifies per-item classification with an explicit precedence, verified to close across repeated self references, repeated outside-selection targets, repeated unresolved targets, and mixtures of all three.

**Round 2 review then found that neither correction had a reproducible artifact behind it.** The reported verification covered the rule as specified, not any implementation of it: the generator still walked only scheduled entries, still counted duplicates and self references per distinct target, and still emitted no node list. That gap is now closed by `conformance.py`, which builds the projection from real Core output under the contract's rules and asserts the contract's invariants, and by fixture entries for the combinations the original set never produced — a repeated self reference, a repeated outside-selection target, a repeated unresolved target, and cycles routed through an unscheduled entry and through a temporally invalid one. `build-projection.py` is retained unmodified and marked superseded, so the rejected behaviour stays inspectable.

Over 40 candidates the checker reports 40 nodes, 27 rows, 17 edges, and 5 invalid nodes, with every invariant passing on both the full and filtered projections. The named cases pass: a repeated self reference gives `declared = 2` against one self reference and one duplicate; a repeated unresolved target gives two unresolved; a repeated in-selection target yields one edge and one duplicate.

The scope correction is measurable rather than theoretical. The checker finds **three** cycles where the superseded generator found one, because two of them route through entries that have no usable interval:

| Cycle                                 | Why the old scope missed it               |
| ------------------------------------- | ----------------------------------------- |
| `loop-a → loop-b → loop-c → loop-a`   | found by both                             |
| `cycle-gap ↔ cycle-via-gap`           | `cycle-gap` is unscheduled                |
| `cycle-bad-dates ↔ cycle-via-invalid` | `cycle-bad-dates` has a reversed interval |

**The projection also emitted an edge to a node it did not contain.** `depends-on-invalid` declares `reversed-interval`, whose dates are invalid, so it appeared in neither `rows` nor `unscheduled` — yet the edge was emitted. Dependencies were computed only for scheduled entries, which also means a cycle passing through an unscheduled or invalid entry is invisible. The contract now separates the dependency graph, which spans every selected candidate, from the timeline, which spans only entries with a usable interval, and normalises the projection into a `nodes` list plus a `rows` list so that every edge endpoint resolves.

**Self-edges are not dropped by existing Graph behavior.** `self-dependency → self-dependency` appears in the Graph output. Dropping it is new Gantt behavior, not inherited behavior.

### Filtered Selection

The following comparison records the original fixture run, before the round-2 cases expanded it to 40 candidates; its edge counts are not counts from the revised conformance run.

A second dependency View filtered the same entries to three of five stages. It is the decisive evidence for the contract's most important choice.

`press-launch` remains in the filtered set and declares two predecessors. Both are in an excluded stage. The filtered Graph output shows **zero** dependencies for it, indistinguishable from an entry that declares none. Seven of the thirteen edges vanish the same way. A reader of a filtered Gantt built on Graph's behavior would conclude that a step has no prerequisites when it has two, both merely outside the View.

This is why the contract counts excluded targets rather than dropping them, and why selection membership is checked before temporal usability: a target outside the selection must not have its content inspected or leaked at all.

## Layout Results

The prototype is a single HTML file using the real `choral-light` and `choral-dark` token values, no framework, no dependency.

**One scroll owner works.** With the timeline scrolled to `scrollLeft=374, scrollTop=120` at 768 px, the sticky title column and the sticky date header both held at a 1 px offset, unchanged from rest. The timeline contains **zero** nested scroll containers. Row alignment needs no synchronized scrolling and no JavaScript scroll sync.

**Day columns cost no per-row DOM.** Day headers contributed exactly 31 nodes at every dataset size, from 29 rows to 4849 rows. Total DOM stayed at roughly 9.4 nodes per row regardless of range width. A cell-per-row-day grid would need 4849 × 31 cells for the largest dataset.

**Bar geometry matched the oracle exactly.** In March 2027: `Press Launch` at day offset 7 spanning 12 columns; `Same Day Walkthrough` at offset 14 spanning 1; `Duplicate Dependency` at offset 21 spanning 5; `Catalogue Print` clipped at the start, offset 0 spanning 5; `Long Span Restoration` clipped at both ends spanning all 31.

**Narrow screens keep everything.** At 390 px the timeline is hidden and the fallback list contained 22 of 22 rows with zero omissions, plus all 7 unscheduled entries. No root horizontal overflow at 390, 768, 1024, or 1440 px in either theme.

**Keyboard access holds.** Real Tab traversal matched `:focus-visible` with a `2px solid` accent outline at a 2 px offset, row titles are reachable in document order, focused rows scroll into view, and the console stayed empty throughout.

Three layout defects were found by measurement and corrected in the prototype.

1. The out-of-range notice was absolutely positioned at the left of a full-width track, so horizontal scrolling carried it out of view and left an unexplained empty row.
2. After making the notice sticky, it satisfied every bounding-box check while sitting **underneath** the sticky title column at maximum scroll. A sticky element inside the timeline must offset its own sticky position by the title column width. Presence in the box model is not evidence of readability.
3. Selecting a row with two predecessors drew one connector, because the second predecessor's interval lay outside the visible month. The list said only "anchored" for both. An absent connector then reads as an absent dependency. Visible range is a host-owned state that must be stated next to the predecessor; the projection keeps `anchored` as a range-independent fact.

Connectors themselves behaved as intended: one orthogonal path from the in-range predecessor, and clean degradation with no path for the out-of-range one.

## Scale Measurements

Local macOS, `cargo build --release`, release `forma` binary, one-shot CLI processes. Each sample is a cold process including workspace loading; OS filesystem caches were not purged. 20 samples per cell, median / p95 in milliseconds. Fixtures are seeded with `20260922`.

| Fixture       | Rows | Edges | Load + list   | `calendar` render | `graph` render | JSON bytes (cal / graph) |
| ------------- | ---- | ----- | ------------- | ----------------- | -------------- | ------------------------ |
| sparse-30     | 30   | 14    | 9.7 / 10.8    | 11.4 / 12.2       | 11.1 / 11.5    | 6,388 / 9,109            |
| sparse-1000   | 1000 | 390   | 61.2 / 69.1   | 106.2 / 110.7     | 102.1 / 108.4  | 193,842 / 260,275        |
| dense-1000    | 1000 | 1974  | 65.2 / 72.9   | 103.8 / 112.5     | 107.1 / 115.2  | 193,062 / 832,099        |
| longspan-1000 | 1000 | 391   | 59.4 / 64.4   | 90.4 / 92.0       | 90.5 / 99.1    | 194,102 / 260,636        |
| sparse-5000   | 5000 | 1965  | 309.5 / 352.3 | 490.9 / 505.3     | 487.4 / 518.3  | 965,984 / 1,304,850      |

Workspace loading is 58 to 63 percent of every measurement. Adding the two render figures would double-count it, because each is a separate process that loads the workspace independently. Subtracting the load baseline gives marginal costs of roughly 45 ms and 41 ms at 1000 rows and 181 ms and 178 ms at 5000 rows, so a single Gantt render that loads once would plausibly land near **147 ms at 1000 rows and 669 ms at 5000 rows**.

That figure is an estimate by decomposition, not a measurement of an implementation. It excludes Gantt's own deduplication, four-state classification, and cycle pass, which is `O(V+E)` over data already in memory but was not measured in Rust. It also includes graph node assembly that Gantt would not emit. Treat it as an order-of-magnitude expectation, not a budget.

Edge density barely affects Core time — dense-1000 cost about the same as sparse-1000 with five times the edges — but tripled the serialized output. Long spans were slightly cheaper than short ones, so span length does not drive Core cost.

### Browser

Viewport 1440 × 900, `choral-light`, isolated prototype. The Browser pane was hidden, so `requestAnimationFrame` never fires; timings force synchronous layout and therefore cover script plus layout, **not paint**. 20 samples per cell.

| Dataset     | Rows | Visible bars | DOM nodes | Initial render | Month switch median / max |
| ----------- | ---- | ------------ | --------- | -------------- | ------------------------- |
| sparse-30   | 29   | 4            | 344       | 4 ms           | 2 / 3 ms                  |
| sparse-1000 | 971  | 105          | 9,142     | 44 ms          | 43 / 47 ms                |
| dense-1000  | 965  | 827          | 8,963     | 56 ms          | 55 / 60 ms                |
| sparse-5000 | 4849 | 516          | 45,406    | 255 ms         | 306 / 322 ms              |

Eight times more visible bars cost 27 percent more time, so bar count is not the driver. At 5000 rows the 306 ms median month switch exceeds Calendar's provisional 200 ms guidance and is perceptible.

The bottleneck was isolated rather than guessed. A targeted experiment rewrote only the track content on each month change and left the sticky title column untouched: at 4849 rows the median switch fell from **306 ms to 1 ms**, with a worst case of 48 ms; at 971 rows it fell from 43 ms to under 1 ms, worst case 12 ms. The cost is rebuilding titles, links, and badges that a range change cannot affect, not rendering bars and not holding 4849 rows in the DOM.

**Row windowing is therefore not required at 5000 rows** under month paging. The bounded fix is to keep the row list stable across range changes and update only range-dependent content.

This conclusion is scoped to the month-paged design and was superseded the same day. See **Continuous Scrolling** below.

## Continuous Scrolling

After the measurements above, the user replaced the bounded-month range with a continuously scrolling timeline and permitted a virtualization dependency if performance required one. The prototype was rebuilt accordingly and re-measured. Same machine, same release binary, same seeded fixtures, viewport 1440 x 900, forced synchronous layout, 20 to 30 samples per cell.

Two fixtures were added to stress horizontal extent together with row count: `scale-wide-1000` and `scale-wide-5000`, each spanning about 1625 days.

### What the change removes

Every row's bar now sits at a real position on one uninterrupted track, so bar clipping, continuation cues, the out-of-range row state, and the visible-range dependency state all disappear. Three of the defects found under month paging — the out-of-range notice scrolling away, that notice hiding under the sticky title column, and a selected row drawing fewer connectors than it lists — were consequences of paging and no longer exist in this form. The sticky-offset rule survives, because the month band label needs it.

The 306 ms month switch also disappears, because there is no month switch.

### Steady-state scrolling is cheap without any windowing

| Fixture | Rows | Day columns | Track width | DOM | Initial render | H-scroll median / max | V-scroll median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sparse-30 | 29 | 442 | 12,616 px | 766 | 3 ms | 0.2 / 0.2 ms | 0.0 ms |
| sparse-1000 | 971 | 462 | 13,176 px | 8,687 | 46 ms | 1.1 / 1.3 ms | 1.1 ms |
| wide-1000 | 969 | 1,715 | 48,260 px | 10,045 | 40 ms | 1.4 / 1.7 ms | 1.4 ms |
| longspan-1000 | 973 | 2,391 | 67,188 px | 10,760 | 39 ms | 1.6 / 1.8 ms | 1.6 ms |
| sparse-5000 | 4,849 | 465 | 13,260 px | 26,696 | 155 ms | 5.6 / 5.9 ms | 5.5 ms |
| wide-5000 | 4,832 | 1,715 | 48,260 px | 27,978 | 177 ms | 5.8 / 6.4 ms | 5.7 ms |

Track width barely matters on its own: five times the width cost 1.1 ms against 1.6 ms. Row count drives everything. At the largest fixture a scroll step costs 5.8 ms, comfortably inside a frame budget, with no windowing at all.

Continuous scrolling is also leaner than month paging was: 26,696 nodes against 45,406 for the same 4849 rows, because no row carries an out-of-range notice.

### Extending the range is the expensive operation

Extension is what makes scrolling unbounded, and it is the only remaining full-width change. Measured at `wide-5000`, extending by 180 days:

| Strategy                                     | Extension median | Extension max |
| -------------------------------------------- | ---------------- | ------------- |
| Naive full re-render                         | 142 ms           | 160 ms        |
| Fixed-epoch variable update, all rows in DOM | 101 ms           | 117 ms        |
| Fixed-epoch variable update, rows windowed   | 12 ms            | 19 ms         |

The fixed-epoch refactor was verified correct rather than assumed: a probe bar's absolute document position was byte-identical before and after a right-edge extension (1517 px), and shifted by exactly 50,400 px on a left-edge extension of 1800 columns. Rows are genuinely untouched.

It still cost 101 ms with all rows present, because changing the total column count re-lays out every row track. That cost scales with rows in the document, which is what windowing removes.

### Unbounded scrolling degrades unless both axes are windowed

Repeating the extension 60 times, reaching 34.3 years of span at 4832 rows:

| Strategy                            | Day label nodes | DOM     | Extension at 34 years                   |
| ----------------------------------- | --------------- | ------- | --------------------------------------- |
| Rows all, columns all               | 12,515          | 13,580  | 58 ms, rising monotonically from 9 ms   |
| Rows all, columns windowed          | 211             | 26,379  | 98 to 120 ms, flat                      |
| Rows windowed, columns all          | grows           | grows   | 9 ms rising to 58 ms                    |
| **Rows windowed, columns windowed** | **211**         | **471** | **3 ms, flat across all 60 extensions** |

Column windowing alone does not help, because the column-count change still re-lays out every row. Row windowing alone degrades with span, because the day header grows without bound. Only both together hold cost and node count flat.

Day ticks come from the same repeating gradient the rows use, so windowing the labels never removes the grid itself.

These figures measure the timeline alone. The always-present complete list required for accessibility was added afterwards and changes them; see **What accessibility costs**.

### Windowing is correct but not yet accessible

The windowed rows were verified contiguous and in source order around the scroll position, with the sticky title column and single scroll owner intact and no root overflow. The accessibility gap is real and measured: at 971 rows only 36 were in the document, 935 were absent, no `aria-rowcount` was published, and the timeline carried only `role="region"`. Assistive technology and browser find-in-page could reach four percent of the rows. The complete list existed but was hidden above 767 px.

Windowing therefore carries an obligation the contract now states: publish the full row count and each row's index, and keep the complete list reachable at every width.

Row windowing also reintroduces the unanchored-connector case in a new form. A predecessor scrolled far away needs no label, because scrolling reaches it. A predecessor whose row is outside the rendered window has no element to anchor to, and must be treated exactly like a predecessor without a usable interval.

### The dependency question, and its answer

The flat 3 ms result came from roughly fifty lines of hand-written two-axis windowing with no dependency, so the measurements never required a virtualizer. That implementation assumes a fixed row height and a fixed day width, which made the deciding factor whether row titles are allowed to wrap.

The user decided on 2026-09-22: **titles stay single-line and truncated, windowing is hand-written, no dependency is added.** Fixed row height therefore became a contract constraint rather than an implementation convenience. `@tanstack/react-virtual` was never installed or benchmarked; what is recorded here is a measurement of the alternative it would have replaced, not a comparison against it. The Task's acceptance criterion forbidding new runtime dependencies stands unchanged.

### Accessible windowing, built and verified

The previous section recorded that windowing broke accessibility and that the contract specified a remedy which had not been built. It has now been built and measured.

Accessibility semantics were verified by reading the accessibility tree, not by inspecting attributes. `display: contents` on the row wrapper did not strip roles: the tree exposes `grid` containing `row`, with `columnheader "Step"` and `columnheader "Dates"` in the header row, and each data row exposing a `rowheader` holding the title link plus a `gridcell` whose accessible name is the row title followed by its date range. Because the bar is purely visual, that accessible name is how the interval reaches a screen reader. Spacer elements do not appear in the tree.

Keyboard traversal reaches every row despite windowing:

| Fixture     | Rows | Probes | Reached | Focus lost | Wrong row | Not scrolled into view | Per keypress |
| ----------- | ---- | ------ | ------- | ---------- | --------- | ---------------------- | ------------ |
| sparse-1000 | 971  | 971    | 971     | 0          | 0         | 0                      | 4.5 ms       |
| wide-5000   | 4832 | 692    | 692     | 0          | 0         | 0                      | 15.9 ms      |

Three regressions were found by measurement while building this, all of the same shape.

**Focus dropped to `<body>` during ordinary arrow-key traversal.** Sixty arrow presses left the focused element outside the document. The cause is the classic virtualization failure: re-rendering replaces the row elements, and a re-render can be triggered by scrolling, by the window shifting, or by extending the range. Restoring focus inside the navigation helper was not enough; it had to move into the render path, capturing the focused row before the grid is replaced and restoring it afterwards.

**`focusRow` re-rendered on every keypress** even when the row window had not moved.

**Every render rebuilt the entire complete list**, which is 971 or 4832 list items that do not depend on the range at all. This cost 21 ms per keypress at 971 rows; decoupling it brought that to 4.5 ms. This is the third time the same rule has been violated in measurement — first row titles under month paging, then row tracks under naive extension, now the complete list — which is why the contract now states it as a standing constraint rather than a finding.

### What accessibility costs

At 4832 rows with two-axis windowing and full ARIA:

| Component     | Nodes  | Scales with                         |
| ------------- | ------ | ----------------------------------- |
| Timeline      | 432    | nothing — flat across rows and span |
| Complete list | 14,499 | rows, at roughly 3 nodes each       |

The always-present complete list is therefore the only part that still grows linearly, and it raises range extension from 3 ms to 12 ms and keyboard traversal from 4.5 ms to 15.9 ms per keypress. Both stay within a frame budget, and the invariants held throughout: `role="grid"`, `aria-rowcount` correct at 4833, zero nested scrollers, no root overflow, horizontal scroll at a 4.4 ms median.

Rendering the list lazily when its disclosure opens would recover those nodes at the cost of find-in-page reaching only the rendered window until the list is opened. The contract permits that, provided the disclosure is always present and announced.

### Scroll axis lock, built and rejected

A two-dimensional scroller has a problem a one-dimensional one does not: a mostly horizontal trackpad gesture drags the rows along with it, and native scrolling offers no cross-axis threshold. A wheel-level axis lock was built, measured against replayed gestures, and then **withdrawn after real-device testing showed it does not work.** The code has been removed from the prototype and the requirement from the contract.

**The measurement that said it worked was flawed.** Every synthetic gesture used `cancelable: true` wheel events. Chromium on macOS delivers **non-cancelable** wheel events during the momentum phase of a trackpad gesture, and `preventDefault` is a no-op on those. Replaying the same gesture with `cancelable: false` reproduced the failure exactly: twenty events, zero prevented, 120 px of vertical drift applied by the browser — while the handler's own counter reported that it had suppressed 120 px. The bookkeeping was reporting a fiction.

The practical behaviour is therefore: the lock holds while the finger is on the trackpad, and the browser resumes two-axis scrolling through the inertia tail, which is where most of the distance travels. That is what a viewer sees as the drift never going away.

The threshold was not the problem, which was checked before concluding: the lock engaged on every event up to cross-axis noise of 60 percent of the major axis, and only began falling through at 80 percent. Tuning would not have helped.

For the record, the drift the lock was meant to remove is real and was quantified before the approach was rejected. A replayed horizontal gesture with the one-directional noise a real hand produces carried 81 px of unintended vertical movement over a 612 px swipe, about two and a half rows at a 34 px row height; a steadier gesture nets out to almost nothing but reverses direction four times, which is the visible wobble rather than the displacement.

Removing it is the right call rather than a retreat. Suppressing an axis reliably would mean taking native scrolling off that axis entirely and driving it from script, which costs momentum, rubber-band overscroll, scrollbar dragging, and the single-scroll-owner invariant the whole layout depends on. The user chose to keep the native interaction, and the evidence supports that.

### Connector feasibility spike

Deferring connectors is only safe if adding them later does not require rearchitecting, so that was tested directly rather than assumed.

**Row windowing does not block connectors.** Geometry is computed from row index and date offset arithmetic, never from `getBoundingClientRect`, so an endpoint does not need its row in the document. An edge spanning 942 rows, from index 952 to index 10, was drawn with only 36 rows rendered; scrolling to each endpoint afterwards showed the predicted position matched the real bar exactly on the horizontal axis and within 1 px vertically, at a scroll depth of 32,428 px and a track offset of 44,592 px.

**Scale is not a constraint, and a full overlay beats a windowed one.**

| Fixture   | Rows | Edges | Mode     | Paths   | Overlay size     | Draw once | Scroll median / max |
| --------- | ---- | ----- | -------- | ------- | ---------------- | --------- | ------------------- |
| wide-1000 | 969  | 418   | Full     | 405     | 48,260 × 32,990  | 3 ms      | 1.1 / 1.2 ms        |
| wide-1000 | 969  | 418   | Viewport | 46 peak | 1,406 × 538      | 3 ms      | 5.0 / 9.1 ms        |
| wide-5000 | 4832 | 1943  | Full     | 1,882   | 48,260 × 164,332 | 16 ms     | 4.9 / 6.2 ms        |
| wide-5000 | 4832 | 1943  | Viewport | 50 peak | 1,406 × 538      | 17 ms     | 22.9 / 27.4 ms      |

A 164,332 px tall SVG rendered without trouble. Windowing the overlay trades a one-time draw for work on every scroll step and is the worse deal.

**The useful finding is that all-edge connectors would not help.** Rows are ordered by start date, so a dependency lands anywhere in the list:

| Fixture     | Median edge span | p90   | Max   | Median vertical distance | Both ends on one screen |
| ----------- | ---------------- | ----- | ----- | ------------------------ | ----------------------- |
| sparse-1000 | 297 rows         | 680   | 926   | 10,098 px                | 3.3 %                   |
| wide-1000   | 295 rows         | 629   | 942   | 10,030 px                | 2.2 %                   |
| wide-5000   | 1,356 rows       | 3,163 | 4,796 | 46,104 px                | 0.8 %                   |

At 5000 rows, 99.2 percent of connectors would join two points that cannot be visible at the same time. They would render as vertical lines leaving the viewport at both ends, which is technically correct and informationally worthless.

The constraint is row ordering, not connector rendering or routing. A dependency-aware row order is a sort concern the existing `sort` field already accommodates, so pursuing graphical dependency reading later requires no change to the projection, the geometry, or the layout.

Not tested: orthogonal routing with collision avoidance, visual legibility at high edge density over a narrow span, and connector behaviour under a dependency-aware row order, which does not exist yet.

## Conclusion

**Go for the contract and the layout approach**, with the corrections above already folded into [[proposals/gantt-temporal-view-contract]]. The conclusion survived the move from month paging to continuous scrolling, which was measured rather than assumed.

The temporal half is settled: it reuses semantics that are already accepted, already implemented, and now re-verified against real Core output at day resolution with genuine DST and timezone cases. The layout bet is validated: sticky-both-axes in one scroll container, shared day ticks, HTML and CSS bars, and a complete narrow-screen list all work with zero new dependencies and no scroll synchronization.

The dependency half is the part that earns its complexity, and it is also where the validation found the most. Three of the corrections — counting index references, closing the count arithmetic, and labelling out-of-range predecessors — exist because a naive implementation silently under-reports a step's prerequisites. The filtered-selection measurement shows that failure mode concretely.

Scale is acceptable with one known, bounded change. Core cost is linear and dominated by workspace loading that every View mode already pays, and continuous scrolling does not change any Core figure because the projection is range-independent. In the browser, continuous scrolling is cheaper than month paging in steady state and concentrates all cost into range extension, which needs two-axis windowing to stay flat. Fifty lines of hand-written windowing achieved that with no dependency, and the user's decision to keep row titles single-line makes that sufficient rather than provisional.

Diagonal drift in the two-dimensional scroller is a real effect that was quantified, and a wheel-level axis lock was built and then rejected: non-cancelable momentum events make it ineffective for most of a gesture, and the native interaction is retained. This is also a caution about method — synthetic wheel events were clean enough to make a broken approach look like it worked, and only real-device testing caught it.

Not validated by this work: touch-drag scrolling, orthogonal connector routing with collision avoidance, connector legibility at high edge density over a narrow span, any relation other than finish-to-start, real Safari and mobile hosts, the installed VS Code host, static output, production WebApp integration, and Gantt Core cost in Rust. Connector _feasibility_ was tested and is not on this list: all-edge rendering was measured at scale and works, and what was left unproven is whether it is useful, which the row-span measurement answers separately. Milestone presentation was exercised only as an explicit boolean flag. `@tanstack/react-virtual` was not installed or benchmarked. Continuous-scroll timings were taken with the Browser pane hidden, so they cover script and layout but not paint. The only real-device input testing in this work was the user's trackpad test of the axis lock, which is what caught that approach; scrolling performance itself was never observed on real hardware. Accessible windowing was built and verified against the accessibility tree and keyboard traversal, but never against a real screen reader, and screen-reader announcement of a shifting row window is the most likely place for it to fall short. Browser find-in-page still reaches only the rendered window plus the complete list, which is inherent to windowing rather than a defect in this implementation. This record is validation evidence and a go recommendation; it is not delivery acceptance, independent review, or authorization to implement.

## Evidence

Working files, fixtures, seeded manifests, oracle results, projections, prototype, and raw measurements are under `knowledge/workspace/tiscs/local/scratch/gantt-validation-20260922/`, which is local-only and outside commits. The generated prototype pages were deleted afterwards as regenerable output; `build-scale-prototype.py` and the templates beside it remain, and the note above already records that those pages predated the corrected wire shape and were never a measurement of it.
