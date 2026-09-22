---
schemaVersion: 1
kind: proposal
scope: project
type: proposal
status: accepted
title: Gantt Temporal View Contract
summary: Accepted read-only Gantt interval, milestone, and dependency semantics with cross-surface capabilities and seeded validation fixtures.
owners: []
assignees: []
reviewers: []
tags:
    - proposal
    - views
    - gantt
sources:
    - architecture/forma-view-query-model
    - guidelines/forma-product-model-and-configuration-fidelity
    - guidelines/dependency-governance
relatedTo:
    - tasks/validate-lightweight-gantt-view
    - tasks/define-temporal-view-contract
    - proposals/calendar-temporal-view-contract
---

# Gantt Temporal View Contract

## Summary

Add a read-only `gantt` View mode that projects explicitly configured intervals as day-resolution timeline rows, and explicitly configured frontmatter references as finish-to-start dependency edges. Core owns schema binding, temporal normalization, dependency resolution, deduplication, cycle detection, and diagnostics. Hosts own geometry. Reuse the accepted Calendar temporal semantics rather than introducing a second temporal evaluator, and add no Gantt, charting, date, timezone, or virtualization dependency.

This contract is **accepted** by explicit user approval on 2026-09-22, following design review, authorized implementation, and commit `217fa2e`. Acceptance applies to the design and its stated boundaries; it does not declare final task acceptance, installed-host validation, or release completion. Existing Views, including Calendar, retain their current meaning and wire format.

### Acceptance Record — 2026-09-22

The user explicitly approved moving this proposal to accepted after evaluating its status against the completed review and implementation. Related tasks remain reviewing; owner/reviewer metadata remains unassigned. The historical preparation and review sections below remain evidence of their original stages, not a pending proposal-status decision. Remaining validation and test-coverage gaps are tracked in [[planning/gantt-view-implementation-plan]] and [[tasks/validate-lightweight-gantt-view]].

The accepted scope is day resolution only, milestones from an explicit boolean binding with no inference, finish-to-start as the only relation, six dependency target states whose counts must close, connectors bounded by a row-count threshold, no configured range or zoom keys, and reuse of Calendar's temporal normalization unchanged. The **Review Decision** section preserves the earlier review record.

Assertions of the form "measurement showed" or "measurement confirmed" refer to the prototype and fixture work recorded in [[design/gantt-view-validation-2026-09-22]], which also carries the go recommendation and the list of what remains unproven. That record is evidence, not review.

## Source Evidence — Pre-Implementation Baseline

Preparation baseline: `afc3bc7`. At preparation time the working tree carried only the uncommitted Development Preparation section of [[tasks/validate-lightweight-gantt-view]]; the validation record, contract, and implementation plan were added afterwards. Repository `forma check`, `forma workspace health`, and `forma inspect` on that task each reported zero diagnostics. Effective workspace settings declare canonical language `en` and timezone `Asia/Shanghai`.

- `crates/forma-core/src/render.rs` dispatches View modes at exactly three sites: the render-required mode allowlist, `view_definition_is_valid`, and the mode match inside `render_view_definition`. A `gantt` variant is additive at those sites plus a new `ViewRenderOutput` member; the union is already `#[serde(tag = "kind")]`.
- `crates/forma-core/src/render/calendar.rs` owns strict civil-date parsing, offset-instant parsing, workspace-timezone civil-span derivation, inclusive authored date ends, exclusive datetime ends, and point normalization. Its `Definition`, `Binding`, `field_node`, `field_type`, and `normalize` items are private and emit Calendar-specific codes; it is not yet a reusable temporal interface.
- `value_for_target` in `render.rs` strips exactly the `fields.` prefix before reading `RenderCandidate.metadata`. `field_node` in `calendar.rs` refuses to traverse a list or scalar, which is correct for a scalar temporal binding and insufficient for a reference binding.
- `collect_semantic_reference_fields` in `crates/forma-core/src/document.rs` builds each `SemanticReferenceField.field` as a dotted frontmatter path, recursing into `SchemaNode::Object` and flattening `SchemaNode::List` onto the same path with `many = true`. Both `SchemaNode::Named` resolving to an `entryRef` semantic type and bare `SchemaNode::EntryRef` produce reference fields. `IndexReference.field` carries that same dotted path, so a `fields.<path>` dependency binding maps to it by stripping the prefix.
- **Unresolved references never become index references.** `resolve_frontmatter_ref_value` in `crates/forma-core/src/index.rs` pushes an `entryRef.unresolved` error (and `entryRef.transformFailed` or the ambiguous variant) and returns without appending to `refs`; `unresolved_and_ambiguous_refs_are_diagnostics_not_index_refs` asserts this. A Gantt adapter therefore cannot classify a specific unresolved target from `entry.refs`, and must derive a declared-versus-resolved count from the bound raw frontmatter value instead. This corrects the assumption recorded in the task's preparation section.
- Graph edge construction in `render.rs` silently skips any reference whose `target_path` is absent from `included_paths`. Gantt must not copy that behavior unmodified: the task requires distinguishing a target excluded by source/query from a target that does not resolve at all.
- Configured semantic types in this workspace resolve `member`, `task`, `test-case`, `user-story`, `metric`, `experiment`, and `release` to `entryRef`. There is no date-alias semantic type, and this contract does not introduce one.
- `packages/shared/src/calendar.ts` holds Calendar wire types and the deterministic range-label formatter. `packages/webapp/src/features/dashboard/calendar-layout.ts` is feature-local civil-date layout, not a scheduling engine. Core already depends on chrono and chrono-tz; `packages/shared` has no runtime dependency.

## Proposed Contract

### Configuration

Use the existing `source`, optional `query`, and optional `sort` fields. Add only `mode: gantt` and its mode-specific block:

```yaml
kind: view
title: Exhibition Preparation Timeline
mode: gantt
source:
    type: pages
    taxonomy:
        collections:
            - preparation
gantt:
    start:
        field: fields.startsOn
    end:
        field: fields.endsOn
    milestone:
        field: fields.isMilestone
    progress:
        field: fields.percentComplete
    dependencies:
        field: fields.predecessors
        relation: finishToStart
    presentation:
        rows:
            colorBy:
                taxonomy: stages
```

`gantt.start.field` is required. `gantt.end`, `gantt.milestone`, `gantt.progress`, `gantt.dependencies`, and `gantt.presentation` are optional. All bindings use the existing `fields.<path>` syntax, matching Calendar rather than Graph's bare field name. `relation` accepts exactly `finishToStart` in this contract and defaults to it; any other value is a binding error rather than a silently ignored key. Reserving the key keeps later relation types additive.

The timeline has no configured range. Continuous scrolling makes the visible window a viewer concern, not a View setting, so this contract adds no range, zoom, or window keys. Day width is host presentation state with a small fixed set of steps, and Today and date jump are scroll operations rather than range changes.

`preparation`, `stages`, `startsOn`, `endsOn`, `isMilestone`, `predecessors`, and the configuration location are arbitrary configured examples. They are never built-in Forma or Task fields, and this contract does not populate dates on this repository's own Tasks.

One candidate entry produces exactly one node and at most one row. Use the canonical entry title with the existing path fallback, and the entry path as node identity and navigation target. Existing source/query selection runs before temporal and dependency evaluation. Configured View sorting determines row order. Without configured sort, order rows by ascending `firstDate`, then ascending `afterLastDate`, then path. Order `nodes` by path, so node order is stable regardless of temporal state.

### Schema Binding

Resolve every binding against the candidate's applicable effective content-group schemas through the Core model, never through a directory or field-name convention.

`start` and `end` follow the accepted Calendar rules unchanged: each must resolve to a scalar `date` or `datetime` schema field; nested object paths are permitted; traversal through a list is rejected; declarations that disagree across applicable schemas are an error rather than an arbitrary pick; and start and end must resolve to the same temporal type within one entry.

`milestone` must resolve to a scalar `boolean` schema field. Only a literal boolean `true` marks a milestone. Missing field, null, absent binding, and any non-boolean value leave the row unmarked; a truthy string or a nonzero number is not a milestone.

`progress` must resolve to a scalar `integer` schema field holding whole percent, `0` through `100` inclusive. Requiring `integer` rather than `number` is deliberate: a ratio convention would make `0.4` silently mean less than one percent, whereas under this binding the same value is rejected by existing schema validation before Gantt sees it. No unit is inferred and no other scale is accepted.

A value outside `0`–`100` leaves the entry without progress and reports `view.ganttProgressInvalid` against that entry; it is never clamped, because clamping would present invented data as authored. A missing field, a null value, and an absent binding all mean no progress, which is distinct from an authored `0`.

Progress belongs to the entry, not to its schedule, so it appears on the node rather than the row. An unscheduled or temporally invalid entry can carry progress and surfaces state it; only a scheduled row can render it as a bar fill.

`dependencies` must resolve to an `entryRef`, a `Named` type whose configured semantic type is `entryRef`, or a list whose items are either of those. A list of lists, an object, or any scalar type is a binding error. Because list schemas flatten onto the same reference path, a scalar reference field and a list reference field are both addressed by the same `fields.<path>` binding.

Missing or null start on a correctly typed field is unscheduled. An empty string is an invalid value. An end without a start is invalid rather than a guessed start. A missing optional dependency field means no declared dependencies, not an error. An empty source is valid and returns an empty projection; configuration errors must still be diagnosed without sample data.

Existing workspace schema-membership validation remains authoritative. Pages excluded by `page.schemaMembership.ambiguous` are not Gantt candidates and are not reinterpreted by this feature.

### Intervals, Points, and Milestones

Reuse the accepted Calendar normalization without modification, so that one entry bound by both Views produces identical civil spans:

| Input                        | Meaning                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| date start only              | One-day interval on that calendar date                              |
| date start and end           | Both authored dates inclusive; normalized to `[start, dayAfterEnd)` |
| datetime start only          | Point at that instant                                               |
| datetime start and equal end | Point at that instant                                               |
| datetime start and later end | Half-open interval `[start, end)`                                   |
| end before start             | Invalid row; excluded from the timeline with a diagnostic           |
| mixed start and end types    | Invalid row; no implicit conversion                                 |

Dates require an exact four-digit `YYYY-MM-DD` string and a real Gregorian date. Datetimes require RFC 3339 with `Z` or an explicit offset; offset-free local datetimes are rejected rather than guessed. Core preserves the exact instant for labels and additionally returns the civil span used for bar geometry as `firstDate` inclusive and `afterLastDate` exclusive, derived in the effective workspace timezone. A timed interval ending exactly at local midnight excludes that ending date. An invalid workspace timezone makes the projection unavailable; never fall back to the browser or operating-system timezone.

Day columns are calendar days. A 23-hour or 25-hour DST day occupies exactly one column of the same width as any other day. Never derive column counts by dividing elapsed milliseconds by 86400000.

A point is a temporal fact. A milestone is explicit configured metadata and nothing else. Do not infer a milestone from a missing end, from equal endpoints, or from a same-day interval; do not infer a point from the milestone flag. The two are orthogonal: a milestone row with a multi-day interval renders both its bar and a marker at `firstDate`, and this combination is not a diagnostic.

### Dependency Semantics

The bound field on entry B lists B's predecessors. The directed edge is A → B, meaning A finishes before B starts. This contract defines the relation label only; it performs no scheduling, applies no lag, enforces no calendar or working-day constraints, and never writes back to source Markdown.

**This version reports the declared relation and nothing else. It does not detect or report conflicts between a relation and the dates.** Defining a conflict requires rules this contract does not have: whether touching endpoints conflict, how a point compares to an interval, and how a date-typed entry compares to a datetime-typed one, where comparing covered civil dates would wrongly clear two instants that overlap within a single day. Leaving that to each host guarantees divergent verdicts. If conflict reporting is wanted later, Core defines the comparison and emits the verdict; hosts never derive it.

**The dependency graph and the timeline have different scopes.** The timeline covers entries with a usable interval. The dependency graph covers **every selected candidate**, including entries that are unscheduled or temporally invalid, because their identity and their declared references are valid even when their dates are not. Restricting the graph to entries that can be drawn silently loses every edge through an unscheduled or invalid entry, and with it any cycle that passes through one.

Match resolved references by exact bound field and frontmatter source. Body links, references on other fields, and references on nested fields that merely share a leaf name must not become dependencies.

**Account for each authored item, not each distinct target.** Count `unresolved` by subtraction — authored items on the bound field minus index references on that field — because the index does not retain a failed entry and no authored position can honestly be attributed to it. Then classify the retained references, in the order the index holds them, by first match:

1. Its target was already accounted for by an earlier retained reference on this field → `duplicates`.
2. Its target is the declaring entry → `selfReferences`.
3. Its target is not in the selected set → `outsideSelection`.
4. Otherwise → a listed predecessor.

First match wins, so every authored item is accounted for exactly once and the counts close by construction. This aggregate form is normative. A positional walk over authored items produces identical counts but requires inventing a pairing between authored positions and retained references, which is why it is forbidden below.

Order matters and was derived from a failure. Classifying by distinct target instead of by authored item makes the buckets overlap: an entry declaring itself twice counted once as a duplicate and twice as a self reference, giving three for two authored items. Checking `duplicates` before `selfReferences` and `outsideSelection` also keeps those two counts meaningful, because a target named twice is one hidden predecessor and one redundant declaration rather than two hidden predecessors. Unresolved items cannot be deduplicated, since nothing resolved to compare.

Selection membership is still checked before temporal usability, so a target outside the selected set never has its content inspected. The resulting states are:

| State | Detection | Projection result |
| --- | --- | --- |
| Anchored | Both the predecessor and declaring node have usable intervals | Listed predecessor and an edge with status `anchored` |
| Unanchored | Either selected endpoint is unscheduled or temporally invalid | Listed predecessor and an edge with status `unanchored`; both endpoints still appear as nodes with paths and titles |
| Outside selection | Target resolves but is excluded by source, query, or surface availability | Counted only; no path, title, label, or link is emitted |
| Unresolved | Declared in the bound field but absent from resolved references | Counted only; the existing index diagnostic remains the locatable source of truth |
| Duplicate | The same resolved target is declared more than once on the bound field | Surplus counted only; the first declaration determines whether an edge is emitted |
| Self reference | The target is the declaring entry | Counted only; the edge is dropped and the row is retained |

The counts must close for every node: `declared` equals listed predecessors plus `outsideSelection` plus `unresolved` plus `duplicates` plus `selfReferences`. This is a consequence of per-item classification rather than an extra rule, and an implementation where it fails has misclassified rather than miscounted. A four-state model was derived first and measured not to balance, because a duplicate declaration and a dropped self reference each vanished from the arithmetic; classifying distinct targets rather than authored items then made two buckets overlap. Both failures are why the precedence above is normative.

Derive the unresolved count as `declared` minus the number of **index references** on the bound field. Count index references, never deduplicated edges: the index retains one reference per authored item, while Graph-style edge assembly collapses duplicates, so using edges reports a duplicate declaration as an unresolved target. Prototype work reproduced exactly that error before correcting it. Because `entryRef.unresolved`, the ambiguous variant, and `entryRef.transformFailed` all suppress the index reference, this single count aggregates them; each already carries its own source-locatable diagnostic with the frontmatter field and item index, and Gantt must not duplicate or restate them. Non-string entries in a reference list are likewise unresolved for this purpose.

Deduplicate edges on the ordered pair `(from, to)` using a deterministic ordered set, so repeated declarations of the same predecessor yield one edge. Diagnose a self-edge and drop that edge while keeping the row and its interval; existing Graph edge assembly does not drop self-edges, so this is new behavior rather than inherited behavior. Detect cycles over the selected dependency graph and report the participating paths in a stable order, without discarding any row, changing row order, or suppressing valid edges. A cycle conclusion describes the selected graph only; it is not a workspace-wide acyclicity claim, and the projection must say so wherever targets outside selection exist.

Navigable predecessor lists are the accessible baseline and are always present. Graphical connectors are an optional presentation layer over the same edges, never a replacement for the list.

Missing or null dependency values declare zero items; a scalar non-null value declares one item and a list declares one per element, including invalid elements. Unsupported binding types produce the binding diagnostic and zero evaluated dependency counts; those zero counts are not evidence of no authored prerequisites. Do not infer per-item positions by zipping raw values with index references after unresolved values have been omitted. Aggregate counting is sufficient: count unresolved items by subtraction, then classify the exact-field resolved references in their retained order. Sort emitted predecessor paths and edges by path and `(from, to)` respectively. Define edge `id` as the compact JSON serialization of `[from, to]`, avoiding collisions when a legal path contains `->`. Cycle diagnostics identify strongly connected components of two or more nodes, with paths and components sorted; a traversal's first back-edge is not sufficient to enumerate all participating nodes. Self references retain their separate diagnostic.

**Connectors are deferred by evidence, not by caution, and nothing in this contract blocks adding them later.** A spike drew every edge at scale and established three things. Geometry is computed from row index and date offset arithmetic rather than from element rectangles, so an endpoint does not need its row rendered: an edge spanning 942 rows with 36 rows in the document landed within 1 px of the real bar at a scroll depth of 32,428 px. Scale is not a constraint: 1,882 paths over 4,832 rows drew once in 16 ms and then cost nothing to scroll, in a 48,260 × 164,332 px overlay the browser rendered without trouble. A full overlay beats a viewport-windowed one, because windowing trades a one-time 16 ms draw for 22.9 ms on every scroll step.

What the spike did settle is that drawing every edge would not be useful. Rows are ordered by start date, so a dependency lands anywhere in the list: the median edge spans 297 rows in a 1,000-row projection and 1,356 rows in a 5,000-row one, and both endpoints fall on one screen for 3.3 percent and 0.8 percent of edges respectively. Ninety-seven percent or more of all-edge connectors would be vertical lines leaving the viewport at both ends.

The lever for graphical dependency reading is therefore **row ordering**, not connector rendering or routing. Dependency-aware ordering is deferred: the existing field-based `sort` is not a graph-ordering algorithm. A future graph-aware sort needs its own semantics and review, although this node/row projection does not prevent it. Connector scope is now bounded by row count rather than fixed to the selection: below the threshold every anchored edge is drawn, above it only the selected row's. The threshold is a judgement, not a measurement, and belongs in the implementation as a named constant with its reasoning.

### Projection

Add a `gantt` member to the existing render union. The projection is normalised into two lists: `nodes` carries identity and dependencies for **every** selected candidate, and `rows` carries geometry for the subset that has a usable interval. Every edge endpoint therefore resolves to a node.

```json
{
    "kind": "gantt",
    "timeZone": "Asia/Shanghai",
    "counts": { "candidates": 4, "scheduled": 2, "unscheduled": 1, "invalid": 1 },
    "nodes": [
        {
            "path": "preparation/budget-approval.md",
            "title": "Budget approval",
            "status": "scheduled",
            "dependencies": {
                "declared": 0,
                "outsideSelection": 0,
                "unresolved": 0,
                "duplicates": 0,
                "selfReferences": 0,
                "predecessors": []
            }
        },
        {
            "path": "preparation/catalogue-print.md",
            "title": "Catalogue print",
            "status": "unscheduled",
            "dependencies": {
                "declared": 1,
                "outsideSelection": 0,
                "unresolved": 0,
                "duplicates": 0,
                "selfReferences": 0,
                "predecessors": ["preparation/venue-hold.md"]
            }
        },
        {
            "path": "preparation/site-survey.md",
            "title": "Site survey",
            "status": "invalid",
            "dependencies": {
                "declared": 0,
                "outsideSelection": 0,
                "unresolved": 0,
                "duplicates": 0,
                "selfReferences": 0,
                "predecessors": []
            }
        },
        {
            "path": "preparation/venue-hold.md",
            "title": "Venue hold",
            "status": "scheduled",
            "progress": 40,
            "dependencies": {
                "declared": 3,
                "outsideSelection": 1,
                "unresolved": 1,
                "duplicates": 0,
                "selfReferences": 0,
                "predecessors": ["preparation/budget-approval.md"]
            }
        }
    ],
    "rows": [
        {
            "path": "preparation/budget-approval.md",
            "temporal": { "kind": "date", "start": "2027-02-01", "endExclusive": "2027-02-20" },
            "firstDate": "2027-02-01",
            "afterLastDate": "2027-02-20",
            "milestone": false
        },
        {
            "path": "preparation/venue-hold.md",
            "temporal": { "kind": "date", "start": "2027-03-01", "endExclusive": "2027-03-08" },
            "firstDate": "2027-03-01",
            "afterLastDate": "2027-03-08",
            "milestone": false
        }
    ],
    "edges": [
        {
            "id": "[\"preparation/budget-approval.md\",\"preparation/venue-hold.md\"]",
            "from": "preparation/budget-approval.md",
            "to": "preparation/venue-hold.md",
            "relation": "finishToStart",
            "status": "anchored"
        },
        {
            "id": "[\"preparation/venue-hold.md\",\"preparation/catalogue-print.md\"]",
            "from": "preparation/venue-hold.md",
            "to": "preparation/catalogue-print.md",
            "relation": "finishToStart",
            "status": "unanchored"
        }
    ]
}
```

This complete example is meant to be checked: four nodes against `candidates: 4`, two rows against `scheduled: 2`, two scheduled nodes and one each unscheduled and invalid, both edge endpoints present in `nodes`, an `unanchored` edge into the unscheduled node, and `declared` closing against the five buckets on every node. An implementation must reproduce it from an equivalent authored fixture.

`progress` is a whole percent from `0` through `100`, omitted when no progress binding is configured, when the field is absent or null, or when the authored value fell outside the range. An omitted `progress` and an authored `0` are different states and must not be conflated.

`status` is `scheduled`, `unscheduled`, or `invalid`, and partitions `nodes` exactly. A node with status `invalid` carries its path, title, and dependencies but never appears in `rows`; its temporal failure is reported through diagnostics, not through the projection. `rows` is ordered by the contract's row ordering and holds no title, because the node owns identity.

`temporal` reuses the accepted Calendar shape exactly, including `{kind: "datetime", start, endExclusive}` with a null end denoting a point. `classification` reuses the accepted Calendar classification shape on the node when `presentation.rows.colorBy` is configured, and is omitted otherwise. Neither list carries pixel coordinates, per-day copies, preformatted localized text, or arbitrary frontmatter.

Require `candidates` to equal `nodes` length, and `scheduled` plus `unscheduled` plus `invalid` to equal it as well, with `scheduled` equal to the length of `rows`. `dependencies.declared` counts authored items on the bound field; `predecessors` lists anchored and unanchored targets after per-item classification. Require the per-node dependency arithmetic stated above to close, and treat a node where it does not as a misclassification rather than a display detail. Counts apply after source and query filtering. The projection performs no truncation and no pagination: the visible window is host presentation state, not an undeclared server query, and View params remain unevaluated.

### Diagnostics

| Proposed code | Severity and behavior |
| --- | --- |
| `view.ganttBindingInvalid` | Error on View configuration; missing or malformed binding syntax, unsupported `relation`, or unknown key; no projection |
| `view.ganttTimezoneInvalid` | Error on View with workspace timezone context; no projection |
| `view.ganttFieldTypeInvalid` | Warning on candidate field; absent, conflicting, or unsupported start/end schema type; count candidate as invalid |
| `view.ganttDateInvalid` | Warning on candidate field; malformed or nonexistent date or instant; count candidate as invalid |
| `view.ganttIntervalInvalid` | Warning on candidate field; reversed or mixed interval, orphan end, or normalization overflow; count candidate as invalid |
| `view.ganttMilestoneFieldInvalid` | Warning on the View binding; the milestone binding does not resolve to a scalar `boolean` schema field. Never emitted for a non-boolean **value**, which workspace schema validation already rejects as `schema.type.invalid`. Rows keep their intervals and stay unmarked |
| `view.ganttProgressFieldInvalid` | Warning on the View binding; the progress binding does not resolve to a scalar `integer` schema field. Collapsed like other binding-type failures. Never emitted for a non-integer **value**, which schema validation already rejects |
| `view.ganttProgressInvalid` | Warning on the candidate field; an integer outside `0`–`100`. The entry keeps its interval and carries no progress |
| `view.ganttDependencyFieldInvalid` | Warning on candidate field; dependency binding does not resolve to a reference or list of references; row keeps its interval with no dependencies |
| `view.ganttDependencySelf` | Warning on candidate field; entry declares itself as a predecessor; edge dropped, row retained |
| `view.ganttDependencyCycle` | Warning on the View, listing participating paths in stable order; all rows and edges retained |

Emit one primary reason per excluded entry in stable order, checking start and type before end and interval. Gantt warnings never downgrade existing errors, and existing schema and reference diagnostics remain authoritative. Missing optional dates and missing optional dependency fields are not diagnostics. A target outside selection is an expected consequence of the configured source and is never a diagnostic; it appears only as a count.

Workspace schema validation already rejects several authored values before any View runs, and Gantt must not treat those as its own responsibility. Measurement against a real workspace confirmed that a non-boolean milestone value reports `schema.type.invalid`, an empty date string and an offset-free datetime report `schema.format.invalid`, and an unresolvable reference reports `entryRef.unresolved`, all at `forma check` time. A nonexistent but well-formed calendar date such as `2027-02-29` is **not** caught there, because the date schema check is lexical, and remains the temporal evaluator's responsibility. Gantt-level value diagnostics therefore exist for values the schema layer permits.

Binding-type failures are evaluated per candidate, because different entries can legitimately carry different applicable schemas. The measured consequence is that one wrong binding produces one warning per candidate: a deliberately mismatched date-start and datetime-end binding over a 33-entry fixture produced 33 identical `view.calendarIntervalInvalid` warnings, including for entries where neither bound field was populated. At Gantt's target scale that is thousands of identical diagnostics for a single configuration mistake. Gantt must collapse binding-type failures that share a code, a bound field, and a reason. Do not achieve this by weakening the per-entry check itself; collapse the reporting, not the checking.

The existing `Diagnostic` carries a single optional `path` and a single optional `location`, so it cannot hold an arbitrary list of affected candidates, and this contract does not extend a shared struct for one feature. The collapsed form is therefore:

- **One** diagnostic located on the View, not on a candidate, whose `actual` states the affected-candidate count and whose message names the bound field and the reason. This is the primary signal, and it is complete on its own.
- **At most ten** additional diagnostics, one per affected candidate in ascending path order, so that a locatable example is always available. The View-level diagnostic states the total, so a reader can tell that the per-candidate list is a sample rather than the whole set.

A binding-type failure is a View configuration problem even when it manifests per candidate, so the View-level diagnostic is authoritative and the samples are an aid. The cap is part of the contract because an uncapped list reintroduces the flood it exists to prevent.

### Rendering and Surface Capabilities

| Surface | Initial capability | Range and dependency behavior |
| --- | --- | --- |
| Core / CLI / RPC | Complete typed node list, row geometry, edges, counts, diagnostics | Deterministic for the same snapshot; no injected current timestamp |
| WebApp | Sticky title column and date header in one local scroll region, day-resolution bars, continuous horizontal scrolling, Today, date jump, day-width selection | One uninterrupted track over the whole data extent, extended on demand at either edge; per-row predecessor list; connectors for every anchored edge in a small projection and for the selected row above a row-count threshold; complete list reachable at every width |
| Static HTML | Deterministic interval and predecessor list for every node, with unscheduled and invalid nodes stated as such | Complete data, no timeline geometry, no dependence on build date, no broken links to unavailable targets |
| VS Code | Same complete interval and predecessor list | Host navigation and theme adaptation |

The WebApp timeline uses exactly one scroll owner so row alignment never requires synchronized scroll containers. Render one bar per row plus shared date ticks and background rules, never a cell per row-day pair.

**The timeline scrolls continuously and is not paged by month.** One uninterrupted track spans the whole data extent, and reaching either edge extends the range rather than stopping. Every row's bar therefore lives at a real position on the same track, so there is no clipping, no continuation cue, and no out-of-range row state. This replaces the bounded-month range this contract originally proposed, at the user's direction on 2026-09-22.

Position bars against a **fixed epoch**, not against the current range start, and express the range as CSS variables for the lead-in column count and the total column count. Extending the range then shifts the whole track by changing a variable instead of recomputing every bar. Measurement confirmed this keeps bar positions byte-identical across a right-edge extension, and it is what makes an extension a variable update rather than a re-layout of every bar.

Three consequences of continuous scrolling need stating, because none of them arises in a paged design.

**Extending at the left must preserve what the viewer is looking at.** Prepending columns moves all content right, so the scroll offset must be advanced by exactly the width gained in the same frame as the range change. The viewer stays on the same dates; only the track grows. An implementation that changes the range without this correction teleports the viewport backwards in time.

**The header carries the year, not only the month.** A continuous track crosses year boundaries without any navigation event to signal it, so a month label that omits the year is ambiguous the moment a span exceeds twelve months. Bar geometry across a year boundary needs no special handling — calendar-day arithmetic already covers it, and a span crossing 31 December was verified — but the header must remain unambiguous at any scroll position.

**The range has two hard limits, and both must stop extension rather than be exceeded silently.**

The first is the temporal domain. Core parses civil dates from `0001-01-01` through `9999-12-31`, but also requires the exclusive `afterLastDate` to remain in that domain. Consequently the renderable day-column domain is `[0001-01-01, 9999-12-31)`, or 3,652,058 columns: `9999-12-31` is an exclusive boundary, not a renderable event day. A date-only entry ending on that date, or a point on that date in the workspace timezone, remains invalid under unchanged Calendar normalization. A datetime interval ending at local midnight on that boundary can be valid. Extension stops at these bounds; a jump outside the renderable day domain is rejected with the control and viewport unchanged, never silently clamped. No year-zero or five-digit sentinel is introduced.

The second is the renderer. The validation record reports a Chrome 152 clamp of 16,777,214 px; that is evidence for one browser, not a portable CSS guarantee. Two-axis windowing reduces node count but not track width. The implementation must establish a conservative materialized-size budget validated in Chromium, Firefox, and WebKit, including the sticky title column and vertical row extent. Check actual layout dimensions as well as requested CSS dimensions. Do not generalize the measured Chrome threshold to every host.

Extension may add only whole columns that fit the budget and must announce when it stops. A date jump or day-width change that would exceed the budget is rejected atomically, preserving the previous width, date and viewport and explaining the limit. On initial load, try smaller offered day widths if the complete data extent does not fit; if none fits, or a layout clamp is detected, expose the complete node/interval/dependency list with an explicit timeline-unavailable reason. Never silently omit distant bars, alter projection data, or position bars on a clamped track. The uninterrupted-track guarantee applies when the timeline is available. Week/month aggregation and segmented or rebased scrolling remain out of scope.

**The timeline keeps native two-dimensional scrolling, and does not intercept the wheel.** A mostly horizontal trackpad gesture does carry some vertical drift, and a wheel-level axis lock was built and rejected on 2026-09-22 after real-device testing. Chromium on macOS delivers non-cancelable wheel events during the momentum phase of a trackpad gesture, so `preventDefault` is a no-op for exactly the part of the gesture that travels furthest: the lock holds while the finger is down and the browser resumes two-axis scrolling through the inertia tail. Suppressing that would require removing native scrolling from an axis entirely, which would cost momentum, rubber-band overscroll, scrollbars, and the single-scroll-owner invariant this contract depends on. An implementation must not reintroduce a wheel-level axis lock without evidence that this browser behavior has changed.

Any sticky element inside the timeline other than the title column must offset its own sticky position by the title column width. Measurement found a notice that satisfied every bounding-box check while sitting underneath the sticky title column at maximum horizontal scroll, so presence in the box model is not evidence that content is readable. Month labels must likewise exclude the title column from their visible positioning region, whether positioned by CSS or imperative DOM coordination.

The subsequent presentation review retained native two-dimensional scrolling but approved hiding both scrollbar controls. This changes presentation, not scroll ownership, momentum, date geometry, or keyboard reachability. Month/year labels use feature-local DOM positioning to center within the visible month intersection; they do not round-trip scroll coordinates through React state. Small transient scroll jitter was accepted rather than adding a new positioning dependency.

**Both axes must be windowed, and windowing carries an accessibility obligation.** Measurement showed that row windowing alone still degrades without bound as the range grows, and that column windowing alone leaves every extension re-laying out every row. Only windowing rows and day labels together holds cost flat. Because windowing removes rows from the document — 36 of 971 rows present in the measured prototype — an implementation must publish the full row count and each row's index to assistive technology, keep every row reachable by keyboard, and keep the complete list reachable at every width. This was built and verified: 971 of 971 rows and 692 probes across 4832 rows were reached with no lost focus and no wrong target. A row a viewer cannot reach by any means has been silently omitted, which this contract forbids.

Row titles are single-line and truncated, so row height is fixed. This is what makes hand-written windowing sufficient and keeps the dependency budget at zero.

**Not rendered is not the same as not anchorable.** `unanchored` means at least one endpoint has no usable interval. An edge with two scheduled endpoints remains `anchored` even when either row is outside the render window: geometry is arithmetic and needs no element. The initial selected-row connector slice may omit off-window connectors while retaining their navigable list entries; this must never change the edge status. No connector is drawn for an `unanchored` edge.

**A bar carries its entry's title, and the title is decoration.** The row's accessible name already states the title and date range, so a visible in-bar label is redundant to assistive technology and must be hidden from it. Clip the label to the bar rather than letting it overflow, and do not widen a bar to fit its text: bar geometry answers to dates only. A bar too narrow to show anything readable shows nothing, because the sticky title column already names every row.

**Progress must be stated as text, not only drawn.** The fill lives inside a decorative, assistive-technology-hidden bar, so on its own it reaches neither a screen reader nor any surface without a timeline. An unscheduled or temporally invalid entry has no bar at all. State the percent in the row's accessible name, in any selection detail, and in the complete list, using one phrasing across surfaces, and render nothing at all when no progress was authored so that an absent value never reads as zero.

**Progress renders as a fill inside the bar, never as a change to its extent.** The fill covers the authored percent of the bar's width and must not alter where the bar starts or ends, so a reader cannot mistake progress for schedule. It must also not degrade the bar's own label. A fill behind the title changes the background the text sits on, so the title is drawn once for the unfilled background and again clipped to the fill, each copy coloured to contrast with what is behind it. Sharing one box keeps the glyphs aligned, and the seam falls exactly where the fill ends. This is what allows a fill strong enough to read at a glance. An entry with no progress renders an ordinary bar. Progress is presentation over an authored number; it is never derived from dates, from today, or from dependency state.

**Selecting and locating are separate gestures.** A continuous track can place a row's bar years from the current viewport, so a viewer needs a way to jump to it; but selection happens on every single click and on every keyboard arrow press, and a viewport that moved each time would be unusable while browsing. Selection therefore never scrolls horizontally, and locating is an explicit double-click.

Single-clicking a row's title or its bar selects that row and moves nothing. Double-clicking either one, or pressing Enter with the grid focused, puts the bar's start two day columns in from the left edge of the track and centres the row under the sticky header. Locating is unconditional: a bar already partly visible still moves, so the gesture always does the same thing and the bar head always lands in the same place. A conditional version was tried first and rejected, because a gesture that sometimes does nothing is harder to trust than one that always repositions.

Connectors are confined to the track. The connector layer is positioned in content space, so it slides under the sticky title column and the sticky header, and it paints over both rather than behind them; raising the sticky cells above it does not change that. The layer is therefore clipped at the current scroll offsets, on the same frame that repositions the month labels rather than from render state, so a connector never appears to cross an entry's title or a date heading.

Locating reserves the track it needs before it scrolls. The offset a bar near the right edge of the range asks for can lie past the end of the current track, and a scroll offset written past the track only moves as far as the track reaches; because the clamped write leaves the offset unchanged, the edge extension that widens the range on scrolling never fires, and repeating the gesture cannot recover. Anchoring the widening on the lead-in column reserves both the columns before the bar and a viewport of track after it, so one gesture is always enough. Vertical centring has no such step: the row list is fixed, so at the ends of the list the clamp is the answer.

**A marker must not sit on top of the title.** A point or milestone marker is drawn at the bar's start, which is exactly where the label begins. Reserve room for it in the text rather than letting it cover the first characters, and do not widen the bar to make space: bar extent answers to dates only.

**Connectors convey direction.** A connector without an arrowhead states that two entries are related but not which one precedes the other, which is the whole content of a finish-to-start edge. Draw the direction explicitly.

An edge whose endpoints are both anchored remains drawable when either row is outside the rendered window, because the geometry is arithmetic. A host that chooses not to draw such a connector must not leave the reader to infer that no dependency exists; the predecessor list is the authoritative statement and stays complete regardless.

Use native HTML and CSS with existing DaisyUI controls; evaluate minimal inline SVG only for connectors. Reuse existing chrono and chrono-tz in Core and Intl in hosts. Today is computed only in the interactive host from the supplied timezone and is never cached in the projection. Human-facing labels follow the host UI locale with the workspace canonical language as fallback; locale never changes bar placement, ordering, or column width.

Gantt implementations and shared types must ship together in a compatible release. Add explicit dispatch in every current consumer and an explicit unsupported-projection message where runtime data can be newer than the consumer. Never map Gantt onto Table, and do not introduce general protocol negotiation for this feature.

## Target

Extract a small Core-internal temporal module only as part of the approved integration slice, when Gantt becomes its second real consumer. It accepts the already-loaded model and configuration plus explicit bindings, returns normalized temporal values and structured failures, and performs no independent workspace loading or filesystem traversal. Calendar and Gantt adapters keep their own projection assembly and diagnostic namespaces. Preserve Calendar wire types, ordering, diagnostics, and every existing Calendar test; do not publish a generic timeline framework.

Keep dependency resolution and validation in Core, consuming existing indexed references and the bound raw frontmatter value. Keep row, bar, and tick geometry feature-local in WebApp. Extend `packages/shared` with projection types and pure display-label helpers only, adding no runtime dependency there. Static HTML and VS Code consume the same normalized nodes and rows and render their own host-appropriate semantic markup.

Stages B and C of [[tasks/validate-lightweight-gantt-view]] validate this contract against fixtures in an isolated prototype. They must not register a production View mode, install a dependency, or introduce a second production temporal evaluator.

## Fixture Manifest

All fixtures are synthetic and seeded. Synthetic results demonstrate capability and correctness; they are not demand validation, and no conclusion may present them as evidence of real user need. If an authorized, sanitized representative plan is supplied later, record its provenance separately and re-report the affected conclusions.

Fixtures use a neutral exhibition-preparation domain at a nonstandard configuration path, with schema fields `startsOn`, `endsOn`, `isMilestone`, and `predecessors`. They never modify this repository's Tasks or their dates. Generator seed `20260922` is fixed and recorded with every measurement, together with row and edge counts, span distribution, machine, build profile, and commit.

| Fixture | Rows | Purpose |
| --- | --- | --- |
| `gantt-oracle` | 30 | Hand-authored expected results for every temporal, milestone, and dependency case below |
| `gantt-sparse` | 1000 | Seeded rows, short spans, low edge density, scattered across one year |
| `gantt-dense` | 1000 | Seeded rows concentrated in one month with high overlap and high edge density |
| `gantt-longspan` | 1000 | Seeded multi-year spans crossing DST and year boundaries |
| `gantt-scale` | 5000 | Seeded mixed distribution for the upper scale sample |
| `gantt-degenerate` | 30 | Empty source, all-unscheduled source, all-invalid source, and a source whose every dependency target is outside selection |

Each fixture records its expected counts, expected row order, and expected edge set as data alongside the workspace, so a prototype run is compared against a written oracle rather than against its own output.

## Verification Cases

| Case | Expected result |
| --- | --- |
| date `2028-02-29`, no end | `firstDate` `2028-02-29`, `afterLastDate` `2028-03-01`, one column |
| date `2027-02-29` | Date-invalid diagnostic; excluded, not rolled into March |
| dates `2027-12-28` through `2028-01-03` | Seven columns spanning the year boundary; one row, one bar |
| datetime `2026-03-08T00:00:00-05:00` to `2026-03-09T00:00:00-04:00`, America/New_York | 23 elapsed hours, one column of standard width |
| datetime `2026-11-01T00:00:00-04:00` to `2026-11-02T00:00:00-05:00`, America/New_York | 25 elapsed hours, one column of standard width |
| point `2026-09-20T16:30:00Z`, Asia/Shanghai | Occupies September 21 with a browser timezone of America/Los_Angeles |
| datetime end at local midnight | Excludes that midnight's date |
| offset-free datetime, reversed interval, mixed types, orphan end | Invalid with one primary source-locatable reason each |
| scalar string field containing `2028-02-29` | Unsupported field type; no date inference |
| `isMilestone: true` with a seven-day interval | Bar and marker both rendered; no diagnostic |
| `percentComplete: 40` with an integer binding | Node carries `progress: 40`; the bar renders a 40 percent fill without changing its extent |
| `percentComplete: 0` | Node carries `progress: 0`, which is distinct from an omitted progress |
| `percentComplete: 140` or `-5` | No progress on the node; `view.ganttProgressInvalid` against that entry; interval retained |
| `percentComplete: 0.4` under an integer binding | Rejected by existing schema validation; Gantt adds no diagnostic |
| progress bound to a `string` or `number` field | Collapsed `view.ganttProgressFieldInvalid`; every entry keeps its interval and carries no progress |
| progress on an unscheduled entry | Node carries the value; no bar exists to fill |
| `isMilestone: "yes"` or `isMilestone: 1` | Unmarked row; interval retained; the existing `schema.type.invalid` error is the only diagnostic, and Gantt adds none |
| point without a milestone binding | Point marker, `milestone` false; not labeled a milestone anywhere |
| dependency field bound to a list of `task` semantic type | Edges resolve through the named type |
| dependency field bound to a nested path such as `fields.plan.predecessors` | Matches the dotted index reference path |
| dependency field bound to a string or enum field | Dependency-field diagnostic; interval retained, no edges |
| same predecessor declared twice | One edge |
| entry declares itself | Self diagnostic; edge dropped, row and interval retained |
| three-entry cycle | Cycle diagnostic naming all three paths; all rows, order, and edges retained |
| predecessor is unscheduled or temporally invalid | Listed predecessor, edge status `unanchored`, no connector |
| predecessor excluded by the configured query | `outsideSelection` count only; no path, title, or link anywhere in the output |
| predecessor target does not exist | `unresolved` count only; existing `entryRef.unresolved` diagnostic is the locatable source |
| body wikilink to another row, with no frontmatter reference | No edge |
| empty, all-unscheduled, all-invalid, and all-outside-selection sources | Correct counts and explicit empty states; no fabricated rows or edges |
| unknown projection kind from a newer backend | Explicit unsupported-projection handling; no Table fallback |

These are proposed oracles, not completed tests. Rendering validation covers 1440, 1024, 768, and 390 px in choral-light and choral-dark, long titles, overlapping spans, multi-year spans, keyboard focus and navigation, source navigation, host-local scrolling without root horizontal overflow, range continuation cues, and a clean browser console. Use playwright-cli across Chromium, Firefox, and WebKit, and report installed Safari, real mobile, and installed VS Code host gaps separately rather than implying coverage.

## Performance Plan

Measure the fixtures above with at least 20 latency samples per row, reporting median and p95 with the sample count stated. Separate Core cold and warm work, initial render, range switching, and scrolling. Record output and DOM size alongside latency. Establish a small-baseline comparison before proposing any budget.

Calendar's recorded 5000-entry timings are not Gantt thresholds and must not be cited as such. Gantt adds dependency resolution, deduplication, and cycle detection on top of temporal normalization, so its Core cost is expected to differ; the measurement must show by how much rather than assume parity.

If measurement shows row windowing is necessary, propose a bounded implementation that keeps every row reachable through accessible navigation. Do not silently truncate rows or edges, do not introduce a virtualization dependency, and do not promise performance against an unmeasured threshold.

### Measured Outcome

This plan was run. Full results are in [[design/gantt-view-validation-2026-09-22]]; the contract-level consequences are:

**Superseded by the continuous-scroll measurement below.** Under the original month-paged design, row windowing was not required at 5000 rows: the bottleneck was rebuilding row titles, links, and badges on every month change, and restricting the update to range-dependent content reduced the 4849-row month switch from a 306 ms median to a 1 ms median. That finding still holds for month paging, but month paging is no longer the design.

**Under continuous scrolling, both axes must be windowed.** Steady-state scrolling is cheap without any windowing — 4832 rows over a 48,260 px track measured a 5.8 ms median horizontal scroll step and a 177 ms initial render, both acceptable. The cost is in extending the range, which is the operation that makes scrolling unbounded. Measured at 4832 rows, extending by 180 days cost a 142 ms median with a naive re-render and 101 ms with a fixed-epoch variable update, because changing the total column count re-lays out every row track in the document. Extending to 34 years of span with rows windowed but day labels not windowed degraded monotonically from 9 ms to 58 ms, with the day header alone reaching 12,515 nodes. Windowing rows and day labels together held the extension at a **3 ms median and 471 DOM nodes, flat across 60 extensions and 34 years of span**. That figure measures the timeline alone; adding the always-present complete list required for accessibility raises it to 12 ms and 14,974 nodes, as stated below. An implementation that windows neither axis, or only one, will degrade without bound as the viewer scrolls.

**Day columns must not scale DOM with rows.** Day ticks come from one repeating gradient, so the grid itself costs no nodes; only day labels do, and those are windowed. An implementation whose node count grows with rows multiplied by days has departed from this contract. Track width barely matters on its own: a 67,188 px track at 973 rows measured a 1.6 ms horizontal scroll step against 1.1 ms for a 13,176 px track.

**Core cost is linear and dominated by workspace loading.** Loading accounted for 58 to 63 percent of every one-shot measurement. Edge density barely affected Core time but tripled serialized output, so output size rather than computation is the dependency-density risk. No Gantt Core budget is set here: what was measured is the reused halves in separate processes, and the single-load figure quoted in the validation record is an estimate by decomposition that excludes Gantt's own deduplication and cycle pass. Continuous scrolling does not change any Core figure, because the projection is already range-independent.

**Decided on 2026-09-22: row titles stay single-line and truncated, windowing is hand-written, and no virtualization dependency is added.** Fixed row height is therefore a contract constraint, not an implementation convenience: an implementation that lets a row title wrap has invalidated the windowing this contract specifies and must revisit the dependency decision rather than work around it. The Task's acceptance criterion forbidding new runtime dependencies stands unchanged, and `@tanstack/react-virtual` was evaluated only as the alternative that was not needed.

**Windowing must be accessible, and this is now specified in detail rather than deferred.** The timeline carries `role="grid"` with `aria-rowcount` covering the full row list, each rendered row carries `role="row"` with its true `aria-rowindex`, the title cell is a `rowheader` and the track a `gridcell` whose accessible name states the row's title and date range, and spacer elements are `role="presentation"` and `aria-hidden`. Keyboard traversal must reach every row: arrow, page, home, and end keys move by row index, scroll the target into the window, re-render once, and place focus on the target. A complete list of every row remains available at every width, not only on narrow screens.

**Focus restoration belongs to the render path, not to its callers.** Any re-render replaces the row elements, and a re-render can be triggered by scrolling, by the window shifting, or by extending the range. Measurement caught focus dropping to `<body>` during ordinary arrow-key traversal when restoration lived in the navigation helper instead. Capture the focused row before replacing the grid and restore it afterwards.

**Content that does not depend on the range must not be rebuilt when the range changes.** This rule has now been violated three times in measurement — by row titles under month paging, by row tracks under naive extension, and by the complete list under every render, which cost 21 ms per keypress at 971 rows until it was decoupled and fell to 4.5 ms. Treat it as a standing implementation constraint.

**The complete list costs roughly three nodes per row, and that is the accepted price of reachability.** At 4832 rows the timeline itself stays flat at 432 nodes while the complete list adds 14,499, which also raises range extension from 3 ms to 12 ms and keyboard traversal from 4.5 ms to 15.9 ms per keypress. Both remain within a frame budget. An implementation may render the list lazily when its disclosure opens, provided the disclosure itself is always present and announced; it may not drop the list to recover the nodes.

## Risk And Confidence

The highest correctness risks are dependency state confusion, cycle detection over a filtered graph, milestone inference, and connector complexity.

Dependency state confusion is the most likely way this feature misleads a reader: an absent predecessor can mean the target does not exist, is filtered out of this View, or exists but has no usable dates, and these have opposite remedies. The six-state table and separate counts address this directly, and the projection must never collapse them into a single "missing" notion.

Cycle detection over a filtered graph is sound only as a statement about the selected graph. Reporting it as a workspace-wide guarantee would be wrong whenever targets outside selection exist; the contract requires the narrower claim.

Connector rendering is the least certain element. Its scope is bounded so that a negative result degrades to a timeline with dependency lists rather than invalidating the feature. A failed connector experiment must be reported as reduced capability, never presented as full graphical Gantt support.

Confidence is high in reuse of the accepted temporal semantics. Prototype evidence supports the layout approach at the measured scale; production Gantt Core cost, cross-browser size budgets, real paint performance, and installed-host accessibility remain implementation verification gates, not completed evidence.

## Review Decision

Historical review-stage status: proposed, revised after external design review on 2026-09-22. The later explicit user acceptance is recorded above; no reviewer identity is inferred or added to metadata.

### External review round 1 — 2026-09-22

Five findings, all reproduced against the prototype and the source before being accepted, and all folded into the text above.

| Finding | Change |
| --- | --- |
| The dependency graph was scoped to entries with usable dates, so edges through unscheduled or invalid entries — and any cycle through one — were lost, and the projection emitted an edge to a node it did not contain | The graph now spans every selected candidate; the projection is normalised into `nodes` plus `rows`, so every edge endpoint resolves |
| The six states were not mutually exclusive: an entry declaring itself twice produced counts summing to three against two authored items, and the fixture had passed only because it lacked that combination | Classification is now per authored item with an explicit precedence, verified to close across repeated self, outside-selection, unresolved, and mixed cases |
| Finish-to-start conflict reporting was required of hosts without defining touching endpoints, point comparison, or date against datetime comparison | Conflict reporting is removed from this version. If wanted later, Core defines the comparison and emits the verdict; hosts never derive it |
| The collapsed binding diagnostic had no implementable shape against the existing single-`path` `Diagnostic`, and the prose and the verification table disagreed on whether a non-boolean milestone value produces a Gantt diagnostic | The collapsed form is now one View-level diagnostic carrying the count plus at most ten path-ordered samples; the milestone diagnostic covers the binding only, and a bad value is owned solely by schema validation |
| Out-of-window predecessors were required to be treated as `unanchored` for lack of an element, contradicting the spike that proved geometry needs no element | `unanchored` is now a data fact only; whether to draw an off-window connector is a presentation choice and never a dependency state |

The same review found that continuous scrolling left year boundaries, left-edge viewport preservation, and very long spans unspecified. All three are now stated.

### External review round 2 — 2026-09-22

Three findings, all reproduced before being accepted.

| Finding | Change |
| --- | --- |
| The projection example violated four of its own invariants: counts disagreed with the node and row lists, and an edge referenced a node the example did not contain | The example is rebuilt as a complete, valid instance covering all three node statuses and both edge statuses, and now states that it is meant to be checked |
| The revised classification and graph scope were reported as verified, but the generator still walked only scheduled entries with the superseded per-target counting and emitted no node list, so the claim had no reproducible artifact | A conformance checker now builds the projection from real Core output under these rules and asserts every invariant, against fixture entries for a repeated self reference, a repeated outside-selection target, a repeated unresolved target, and cycles through an unscheduled and a temporally invalid entry. The scope correction is measurable: three cycles are found where the superseded logic found one |
| "No maximum range" was not a substitute for a supported date range and boundary behaviour, and windowing reduces node count without reducing track width | Both hard limits are now specified: the four-digit-year temporal domain Core already enforces, and a measured renderer clamp of 16,777,214 px in Chrome 152 that makes the full domain representable only at the smallest day width. Extension must stop at either limit and say so; a date jump outside the domain is rejected rather than clamped |

At this review stage, validation had exercised these semantics against real Core output and an isolated prototype, and the corrections were folded in above. [[design/gantt-view-validation-2026-09-22]] holds that evidence and concludes **go** for this contract and the layout approach. Validation evidence alone did not accept the design; the later explicit user acceptance recorded above resolved the design decisions listed below.

On 2026-09-22 the user replaced the bounded-month range with a continuously scrolling timeline and permitted a virtualization dependency if performance required one. That change is folded in above and re-measured. It simplifies the contract: bar clipping, continuation cues, the out-of-range row state, and the visible-range dependency state all disappear, because every bar sits at a real position on one track. It also introduces the two-axis windowing requirement and its accessibility obligation.

The decisions presented for review, and subsequently accepted, were: day-resolution columns as the only initial resolution; milestones exclusively from an explicit boolean binding with no inference; finish-to-start as the only relation, with the key reserved; six dependency target states, with outside-selection, unresolved, duplicate, and self reference reduced to counts that must close against `declared`; connectors scoped to the selected row as an experiment against the list baseline; no configured range, zoom, or window keys; and reuse of Calendar normalization without modifying Calendar's wire format.

The virtualization question is settled. On 2026-09-22 the user chose single-line truncated titles, hand-written windowing, and no dependency, which the measurements support: two-axis windowing without any library held range extension flat at 3 ms across 34 years of span at 4832 rows, and 12 ms once the always-present complete list is included. Fixed row height is now a contract constraint, and an implementation that lets titles wrap must revisit this decision rather than work around it.

Outstanding beyond this contract: owner and reviewer assignment on [[tasks/validate-lightweight-gantt-view]]. That task moved to reviewing during the 2026-09-22 governance reconciliation; this document does not change its lifecycle metadata, and design acceptance does not imply task acceptance.

## Follow-Up

This document was accepted by the user on 2026-09-22 and implemented in `217fa2e` against [[planning/gantt-view-implementation-plan]], whose Implementation Record holds the delivery evidence. What remains:

1. Assign owner and reviewer on [[tasks/validate-lightweight-gantt-view]], and decide whether further work runs under that Task or a new one. Design acceptance does not accept the delivery.
2. Revisit the connector row-count threshold against real workspaces. It is a judgement rather than a measurement, and no intermediate projection size has been measured.
3. Before claiming cross-surface parity, exercise what remains untested outside automated suites: real Safari and mobile, a real screen reader against the windowed row grid, and the installed VS Code host rather than its renderer unit tests. Static HTML output, the VS Code renderer, and shared wire round-tripping against real Core output now have committed tests.

### Historical Independent Review Closure — 2026-09-22

The follow-up review corrected the remaining contract inconsistencies directly: anchorability now requires two scheduled endpoints; the exclusive upper date boundary matches Calendar; oversized timelines have an explicit complete-list fallback and atomic rejection of unsupported navigation; edge identities are collision-free; cycle participants are strongly connected components; and the implementation plan now agrees on locale handling, invalid-node visibility, and off-window connectors. The complete JSON example and strengthened local conformance checker pass, including negative controls and mixed dependency cases. The checker is a fixture adapter over saved Core outputs, not production Gantt verification; its limitations are recorded in the validation report.

No unresolved design blocker was found after these corrections. At that stage this was an engineering handoff assessment, not Task acceptance or implementation authorization. Implementation was subsequently authorized and committed in `217fa2e`, and the design is now explicitly accepted. Keep the scope read-only, dependency-free, and Core-owned as specified. Current remaining work is listed in Follow-Up above; owner/reviewer assignment and final delivery acceptance remain open.
